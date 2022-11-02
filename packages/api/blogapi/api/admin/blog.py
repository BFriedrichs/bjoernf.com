"""
Handler for post publishing and updating
"""
from typing import cast
import re
import datetime
import bson
import pymongo
from aiohttp import web, BodyPartReader

from blogapi import utils
from blogapi.utils import auth, image
from blogapi.application import BlogRequest
from blogapi.models import PostContent, Options


@auth.require
async def create_post(request: BlogRequest):
    database = request.app.database

    insert = {'createdAt': datetime.datetime.utcnow(), 'draft': {}}
    result = database.posts.insert_one(insert)

    return utils.json_response({'post': {'_id': result.inserted_id, **insert}})


@auth.require
async def get_drafts(request: BlogRequest):
    database = request.app.database
    query = {'draft': {'$exists': 1}}

    page = int(request.query.get('page', 1))
    limit = int(request.query.get('limit', 10))
    posts, num_pages, current_page = utils.paginate(
        database.posts, query, page=page, limit=limit)
    posts = posts.sort('createdAt', pymongo.DESCENDING)

    return utils.json_response({'posts': posts, 'numPages': num_pages, 'page': current_page})


@auth.require
async def update_post(request: BlogRequest):
    data = await request.json()
    allowed_keys = ['title', 'tags', 'text', 'html', 'image']
    for key in data.keys():
        if key not in allowed_keys:
            raise web.HTTPBadRequest(reason=f'{key} is not allowed')

    post_id = request.match_info.get('id', None)
    if not post_id:
        return web.HTTPBadRequest(reason="No post id")

    database = request.app.database
    the_update = {'updatedAt': datetime.datetime.utcnow(),
                  **{f'draft.{key}': val for key, val in data.items()}}

    result = database.posts.update_one({'_id': bson.ObjectId(post_id)},
                             {'$set': the_update})
    if result.matched_count == 0:
        return web.HTTPNotFound(reason="Post does not exist")

    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})
    return utils.json_response({'post': post})


@auth.require
async def delete_draft(request: BlogRequest):
    post_id = request.match_info.get('id', None)
    if not post_id:
        return web.HTTPBadRequest(reason="No post id")

    database = request.app.database
    database.posts.update_one({'_id': bson.ObjectId(post_id)},
                        {'$unset': {'draft': 1}})
    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})

    return utils.json_response({'post': post})


@auth.require
async def publish(request: BlogRequest):
    """Publishes a post by merging the draft into the current published object

    Args:
        request (werkzeug.Request): The request object

    Returns:
       web.Response: Updated post data
    """
    post_id = request.match_info.get('id', None)
    if not post_id:
        return web.HTTPBadRequest(reason="No post id")

    database = request.app.database
    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})
    if not post:
        return web.HTTPNotFound(reason="Post does not exist")

    published = post.get('published', {})
    draft = post.get('draft', None)
    if draft is None:
        return web.HTTPBadRequest(reason="No staged changes found")

    merged: PostContent = {
        **published,
        **draft,
    }  # type: ignore

    title = merged.get('title')
    html = merged.get('html')
    published_date = published.get('publishedAt', datetime.datetime.utcnow())

    if not title or not html:
        return web.HTTPBadRequest(reason="Title and text are required")

    remove_multi = re.compile(r"\s+")
    text = merged.get('text') or published.get('text') or ''
    summary = '.'.join(text.split('.')[:3]) + '.'
    summary = remove_multi.sub(" ", summary).strip()
    tags = merged.get('tags', [])
    post_image = merged.get('image')

    version = {
        'title': title,
        'text': text,
        'summary': summary,
        'html': html,
        'tags': tags,
        'image': post_image,
        'publishedAt': published_date,
        'version': published.get('version', 0) + 1
    }

    database.posts.update_one({'_id': bson.ObjectId(post_id)},
                        {'$unset': {'draft': True}, '$set': {'published': version}})

    aws = request.app.aws
    aws.cloudfront_create_invalidation()

    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})
    return utils.json_response({'post': post})


@auth.require
async def unpublish(request: BlogRequest):
    post_id = request.match_info.get('id', None)
    if not post_id:
        return web.HTTPBadRequest(reason="No post id")

    database = request.app.database
    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})
    if not post:
        return web.HTTPNotFound(reason="Post does not exist")

    if post.get('published') is None:
        return web.HTTPBadRequest(reason="Post is not published")

    update = None
    if post.get('draft') is None:
        update = [{'$set': {'draft': '$published'}}, {'$unset': 'published'}]
    else:
        update = {'$unset': {'published': 1}}
    database.posts.update_one({'_id': bson.ObjectId(post_id)},
                        update)

    post = database.posts.find_one(bson.ObjectId(post_id))
    return utils.json_response({'post': post})


@auth.require
async def delete_post(request: BlogRequest):
    post_id = request.match_info.get('id', None)
    if not post_id:
        return web.HTTPBadRequest(reason="No post id")

    database = request.app.database
    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})
    if not post:
        return web.HTTPNotFound(reason="Post does not exist")

    if post.get('published') is not None:
        return web.HTTPBadRequest(reason="Cannot delete published posts")

    database.posts.delete_one({'_id': bson.ObjectId(post_id)})
    return utils.json_response({'post': post})


@auth.require
async def upload(request: BlogRequest):
    post_id = request.match_info.get('id', None)
    if not post_id:
        return web.HTTPBadRequest(reason="No post id")

    database = request.app.database
    post = database.posts.find_one({'_id': bson.ObjectId(post_id)})
    if not post:
        return web.HTTPNotFound(reason="Post does not exist")

    reader = await request.multipart()
    field = cast(BodyPartReader, await reader.next())

    if field is None:
        return web.HTTPBadRequest(reason="Bad request")
    if field.name != 'data' or field.filename is None:
        return web.HTTPBadRequest(reason="Bad request")

    ext = field.filename.split('.')[-1]
    file_name = f'{str(bson.ObjectId())}.{ext}'

    upload_data = bytearray()
    size = 0
    while True:
        chunk = await field.read_chunk()
        if not chunk:
            break
        size += len(chunk)
        upload_data.extend(chunk)

    ext = request.query.get('ext')
    max_size = request.query.get('max_size')
    quality = request.query.get('quality')

    options = Options()
    if ext:
        options['ext'] = ext
    if max_size:
        options['max_size'] = int(max_size)
    if quality:
        options['quality'] = int(quality)

    upload_folder = 'uploads'
    if request.app.config['isdev']:
        upload_folder = 'uploads-dev'

    adjusted = image.compress_image(upload_data, options=options)
    s3_url = request.app.aws.s3_upload_file(
        file_name, adjusted, path=upload_folder)
    if not s3_url:
        return web.HTTPBadRequest(reason="Upload failed")

    file_url = f'https://bjornf.dev/{upload_folder}/{file_name}'
    return utils.json_response({
        'src': file_url,
        'fileName': file_name,
        'fileSize': size,
    })