import http from 'http'
import express from 'express'
import RequestBuffer from './RequestBuffer'

class PendingRequest {
  constructor (req, res) {
    this.req = req
    this.res = res
    this.handled = false
  }
}

const defaultConfigCallback = (app) => {
  app.use(express.bodyParser())
}

class SyncMockServer {
  constructor ({configCallback = defaultConfigCallback, staticPath, requestWindow = 64}) {
    const app = express()
    configCallback(app)
    if (staticPath) {
      app.use(express.static(staticPath))
    }

    this.requestBuffer = new RequestBuffer(requestWindow, this.unhandledRequestHandler.bind(this))
    this.server = http.createServer(app).listen()
    this.port = this.server.address().port

    app.set('port', this.port)
    app.all('*', this.handleRequest.bind(this))
  }

  handleRequest (req, res) {
    this.requestBuffer.push(new PendingRequest(req, res))
  }

  clear () {
    while (this.requestBuffer.size() > 0) {
      this.unhandledRequestHandler(this.requestBuffer.pop())
    }
  }

  unhandledRequestHandler (request) {
    if (!request.handled) {
      request.handled = true
      request.res.status(501).send('Nothing told me how to handle this request')
    }
  }

  respondTo (matcher, callback) {
    this.forEachPendingRequest((request) => {
      if (matcher(request.req)) {
        request.handled = true
        callback(request.req, request.res)
      }
    })
  }

  forEachPendingRequest (callback) {
    this.requestBuffer.forEach((request) => {
      if (!request.handled) {
        callback(request)
      }
    })
  }
}

export default SyncMockServer
