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

class ResponderDSL {
  constructor (mockServer, method, path) {
    this.mockServer = mockServer
    this.method = method
    this.path = path
  }

  withJson (json) {
    this.mockServer.respondTo(this.method, this.path, (responder) => {
      responder.withJson(json)
    })
  }

  withHandler (handler) {
    this.mockServer.respondTo(this.method, this.path, (responder) => {
      responder.withHandler(handler)
    })
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

class PendingResponder {
  constructor (matcher, callback) {
    this.matcher = matcher
    this.callback = callback
  }

  respondTo (request) {
    this.callback(new Responder(request))
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
      return response
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
    if (callback) {
      const pendingResponder = new PendingResponder(methodPathMatcher(method, path), callback)
      this.pendingResponders.push(pendingResponder)
      this.processResponders()
    } else {
      return new ResponderDSL(this, method, path)
    }
  }

  processResponders () {
    for (let i = 0; i < this.pendingResponders.length; i++) {
      const pendingResponder = this.pendingResponders[i]
      const request = this.findPendingRequest(pendingResponder.matcher)
      if (request) {
        pendingResponder.respondTo(request)
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
