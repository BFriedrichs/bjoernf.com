const path = require('path')
const fs = require('fs')
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const { isDevelopment } = require('../util')

const distPath = path.join(__dirname, '..', '..', 'dist')
const appServerPath = path.join(distPath, 'node', 'AppServer.js')
let AppServer = require(appServerPath)

const indexFilePath = path.join(distPath, 'browser', 'index.html')
let indexFile = fs.readFileSync(indexFilePath, { encoding: 'utf-8' })

const reloadInDev = () => {
  if (isDevelopment) {
    delete require.cache[
      Object.keys(require.cache).find((k) => k.endsWith('AppServer.js'))
    ]
    AppServer = null

    AppServer = require(appServerPath)
    indexFile = fs.readFileSync(indexFilePath, { encoding: 'utf-8' })
  }
}

const renderHandler = async (req, res) => {
  reloadInDev()

  const AppServerElement = AppServer.default
  const createSSRContext = AppServer.createSSRContext
  try {
    const { resolveData } = createSSRContext()

    const RenderComponent = React.createElement(AppServerElement, {
      ssr: { url: req.path },
    })

    const _prepRun = ReactDOMServer.renderToString(RenderComponent)
    const resolvedData = await resolveData()

    const renderedApp = ReactDOMServer.renderToString(RenderComponent)
    let hydratedIndex = indexFile.replace(
      '<div id="root"></div>',
      `<div id="root">${renderedApp}</div>`
    )

    const extraScript = `window.__RESOLVED_DATA = ${JSON.stringify(
      resolvedData
    )};`
    hydratedIndex = hydratedIndex.replace(
      '<script id="ssr-scripts"></script>',
      `<script type="text/javascript" id="ssr-scripts">${extraScript}</script>`
    )

    res.send(Buffer.from(hydratedIndex))
  } catch (e) {
    console.log(e)
    res.status(200)
    res.send(Buffer.from(indexFile))
  }
}

module.exports = { renderHandler }
