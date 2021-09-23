from aiohttp import web
import datetime
import bson
import os
import re
import pymongo

from blogapi import util


async def login_handler(request):
  auth_header = request.headers.get('Authorization', None)
  if auth_header:
    raise web.HTTPBadRequest(reason="Already logged in")

  data = await request.json()

  username = data.get('username')
  password = data.get('password')
  if not username or not password:
    raise web.HTTPBadRequest(reason="Username and password are required")

  db = request.use('db')
  user = db.users.find_one({'username': username})
  if not user:
    raise web.HTTPBadRequest(reason="User not found")

  is_valid = util.check_password_hash(user['password'], password)
  if not is_valid:
    raise web.HTTPBadRequest(reason="Incorrect login credentials")

  auth = request.use('auth')
  token = auth.create_user_token(user)
  db.users.update_one({'_id': user['_id']}, {'$set': {'token': token}})

  return util.json_response({'user': user, 'token': token})


@util.auth
async def create_post(request):
  db = request.use('db')

  insert = {'createdAt': datetime.datetime.now(), 'draft': True}
  op = db.posts.insert_one(insert)

  return util.json_response({'post': {'_id': op.inserted_id, **insert}})


@util.auth
async def get_drafts(request):
  db = request.use('db')
  query = {'draft': True}

  page = int(request.query.get('page', 1))
  limit = int(request.query.get('limit', 10))
  posts, num_pages, current_page = util.paginate(db.posts, query, page=page, limit=limit)
  posts = posts.sort('createdAt', pymongo.DESCENDING)

  return util.json_response({'posts': posts, 'numPages': num_pages, 'page': current_page})


@util.auth
async def update_post(request):
  data = await request.json()
  allowed_keys = ['title', 'tags', 'text', 'html']
  for key in data.keys():
    if key not in allowed_keys:
      raise web.HTTPBadRequest(reason=f'{key} is not allowed')

  post_id = request.match_info.get('id', None)
  if not post_id:
    return web.HTTPBadRequest(reason="No post id")

  db = request.use('db')
  the_update = {'updatedAt': datetime.datetime.now(),
                'draftChanges': True, **data}

  op = db.posts.update_one({'_id': bson.ObjectId(post_id)},
                           {'$set': the_update})
  if op.matched_count == 0:
    return web.HTTPNotFound(reason="Post does not exist")

  return util.json_response({'post': the_update})


@util.auth
async def publish(request):
  post_id = request.match_info.get('id', None)
  if not post_id:
    return web.HTTPBadRequest(reason="No post id")

  db = request.use('db')
  post = db.posts.find_one({'_id': bson.ObjectId(post_id)})
  if not post:
    return web.HTTPNotFound(reason="Post does not exist")

  remove_multi = re.compile(r"\s+")
  summary = '.'.join(post['text'].split('.')[:3]) + '.'
  summary = remove_multi.sub(" ", summary).strip()

  version = {
    'title': post['title'],
    'text': post['text'],
    'summary': summary,
    'html': post['html'],
    'tags': post['tags'],
    'publishedAt': datetime.datetime.now(),
    'version': post.get('publishedVersion', {}).get('version', 0) + 1
  }

  db.posts.update_one({'_id': bson.ObjectId(post_id)},
                      {'$set': {'draft': False,
                                'draftChanges': False,
                                'publishedVersion': version}})

  post = db.posts.find_one({'_id': bson.ObjectId(post_id)})
  return util.json_response({'post': post})


@util.auth
async def unpublish(request):
  post_id = request.match_info.get('id', None)
  if not post_id:
    return web.HTTPBadRequest(reason="No post id")

  db = request.use('db')
  post = db.posts.find_one({'_id': bson.ObjectId(post_id)})
  if not post:
    return web.HTTPNotFound(reason="Post does not exist")

  db.posts.update_one({'_id': bson.ObjectId(post_id)},
                      {'$set': {'draft': True}})

  return util.json_response({'post': post})


@util.auth
async def upload(request):
  post_id = request.match_info.get('id', None)
  if not post_id:
    return web.HTTPBadRequest(reason="No post id")

  db = request.use('db')
  post = db.posts.find_one({'_id': bson.ObjectId(post_id)})
  if not post:
    return web.HTTPNotFound(reason="Post does not exist")

  reader = await request.multipart()
  field = await reader.next()
  if field.name != 'data':
    return web.HTTPBadRequest(reason="Bad request")

  ext = field.filename.split('.')[-1]
  file_name = f'{str(bson.ObjectId())}.{ext}'
  save_path = os.path.join(post_id, file_name)
  upload_path = util.get_upload_path(save_path)

  size = 0
  with open(upload_path, 'wb') as f:
    while True:
      chunk = await field.read_chunk()
      if not chunk:
          break
      size += len(chunk)
      f.write(chunk)

  return util.json_response({
    'src': f'/uploads/{post_id}/{file_name}',
    'fileSize': size,
    'fileName': file_name
  })