import http from 'http'
import express from 'express'
import RequestBuffer from './RequestBuffer'
import bodyParser from 'body-parser'

class PendingRequest {
  constructor (req, res) {
    this.req = req
    this.res = res
    this.handled = false
  }
}

class Responder {
  constructor (pendingRequst) {
    this.request = pendingRequst
  }

  withHandler (handler) {
    this.request.handled = true
    handler(this.request.req, this.request.res)
  }

  withJson (json) {
    this.withHandler((req, res) => {
      res.json(json)
    })
  }
}

const defaultConfigCallback = (app) => {
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({extended: true}))
}

export const methodPathMatcher = (method, path) => ({req}) => {
  return req.url === path && req.method === method
}

const withMockServer = (options, callback) => {
  const mockServer = new SyncMockServer(options)
  try {
    const response = callback(mockServer)
    if (response && typeof response.then === 'function') {
      response.then(() => mockServer.close(), () => mockServer.close())
    } else {
      mockServer.close()
    }
  } catch (e) {
    mockServer.close()
    throw e
  }
}

export class SyncMockServer {
  constructor ({configCallback = defaultConfigCallback, staticPath, requestWindow = 64} = {}) {
    const app = express()
    configCallback(app)
    if (staticPath) {
      app.use(express.static(staticPath))
    }

    this.requestBuffer = new RequestBuffer(requestWindow, this.unhandledRequestHandler.bind(this))
    this.pendingResponders = []
    this.server = http.createServer(app).listen()
    this.port = this.server.address().port

    app.set('port', this.port)
    app.all('*', this.storeRequestForLaterHandling.bind(this))
  }

  storeRequestForLaterHandling (req, res) {
    this.requestBuffer.push(new PendingRequest(req, res))
    this.processResponders()
  }

  clear () {
    while (this.requestBuffer.size() > 0) {
      this.unhandledRequestHandler(this.requestBuffer.pop())
    }
  }

  close () {
    this.server.close()
  }

  unhandledRequestHandler (request) {
    if (!request.handled) {
      request.handled = true
      request.res.status(501).send('Nothing told me how to handle this request')
    }
  }

  respondTo (method, path, callback) {
    this.pendingResponders.push([methodPathMatcher(method, path), callback])
    this.processResponders()
  }

  processResponders () {
    for (let i = 0; i < this.pendingResponders.length; i++) {
      const [matcher, callback] = this.pendingResponders[i]
      const request = this.findPendingRequest(matcher)
      if (request) {
        callback(new Responder(request))
        delete this.pendingResponders[i]
        i--
      }
    }
  }

  findPendingRequest (matcher) {
    for (var i = 0; i < this.requestBuffer.size(); i++) {
      const r = this.requestBuffer.get(i)
      if (!r.handled && matcher(r)) {
        return r
      }
    }
  }

  forEachPendingRequest (callback) {
    this.requestBuffer.forEach((request) => {
      if (!request.handled) {
        callback(request)
      }
    })
  }

  url (path) {
    return `http://127.0.0.1:${this.port}${path}`
  }
}

export default withMockServer
