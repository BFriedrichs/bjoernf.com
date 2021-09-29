import time
from aiohttp import web
import bson
import pymongo
import re

from blogapi import util


public_projection = {'published': 1, 'createdAt': 1}


async def get_all_posts_handler(request):
  db = request.use('db')
  query = {'published': {'$exists': True}}

  projection = public_projection
  if request.get('user'):
    projection = None

  page = int(request.query.get('page', 1))
  search = request.query.get('search', '')
  if search != '':
    rgx = re.compile(search, re.I)
    query = {
      **query,
      '$or': [
        {'published.text': {'$regex': rgx}},
        {'published.title': {'$regex': rgx}},
        {'published.tags': {'$regex': rgx}}
      ]
    }

  limit = int(request.query.get('limit', 10))
  paginated = util.paginate(db.posts,
                            query,
                            page=page,
                            limit=limit,
                            projection=projection)

  posts, num_pages, current_page = paginated
  posts = posts.sort('createdAt', pymongo.DESCENDING)

  return util.json_response({'posts': posts, 'numPages': num_pages, 'page': current_page})


async def get_post_handler(request):
  post_id = request.match_info.get('id', None)
  if not post_id:
    return web.HTTPBadRequest(reason="No post id")

  db = request.use('db')
  query = {'_id': bson.ObjectId(post_id), 'published': {'$exists': True}}
  projection = public_projection

  if request.get('user'):
    del query['published']
    projection = None

  post = db.posts.find_one(query, projection)
  if not post:
    return web.HTTPNotFound(reason="Post does not exist")

  return util.json_response({'post': post})


async def get_tags(request):
  db = request.use('db')

  tags = db.posts.distinct('published.tags')

  return util.json_response({'tags': tags})
