console.log('Starting server...')

const { isDevelopment, getArguments } = require('./util')
const http = require('http')
const express = require('express')
const bodyParser = require('body-parser')
const nodeFetch = import('node-fetch')

if (!global.fetch) {
  global.fetch = nodeFetch.default
  global.Headers = nodeFetch.Headers
}

const { renderHandler } = require('./handler/render')
const { staticHandler } = require('./handler/static')

const args = getArguments()
const ADDRESS = args.address
const PORT = args.port

const createApp = () => {
  const app = express()

  app.use(bodyParser.json())

  app.get('/*', async function (req, res) {
    if (
      isDevelopment &&
      (req.path.indexOf('static/') !== -1 || req.path.endsWith('.js.map'))
    ) {
      return await staticHandler(req, res)
    }
    res.set('Content-Type', 'text/html')
    return await renderHandler(req, res)
  })

  return app
}

const app = createApp()
let server = http.Server(app)
server.listen(PORT, ADDRESS, function () {
  console.log('React render server listening at http://' + ADDRESS + ':' + PORT)
})

// if (process.env.NODE_ENV === 'development') {
//   const watch = spawn('node', ['watcher.js'])

//   const restart = () => {
//     server.close(() => {
//       server = http.Server(app)
//       startListen(server)
//     })
//   }

//   watch.stdout.on('data', restart)

//   // watch.stderr.on('data', restart)

//   watch.on('close', () => server.close())
// }