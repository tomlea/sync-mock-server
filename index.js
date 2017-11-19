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

export class ResponderDSL {
  constructor (mockServer, method, path) {
    this.constructionCompleted = false
    setTimeout(() => {
      if (!this.constructionCompleted) {
        const callSignature = `mockServer.respondTo(${JSON.stringify(method)}, ${JSON.stringify(path)})`
        const callSignatures = Object.getOwnPropertyNames(ResponderDSL.prototype).map((method) => `\t${callSignature}.${method}(…)`)
        console.warn(`Incomplete responder detected.\nUsage:\n${callSignatures.join('\n')}`)
      }
    }, 10)
    this.mockServer = mockServer
    this.method = method
    this.path = path
    this.constructionCompletedChecker = () => {
      if (this.constructionCompleted) {
        throw new Error('You can only set one response in a single handler')
      } else {
        this.constructionCompleted = true
      }
    }
  }

  withJson (json) {
    this.constructionCompletedChecker()
    this.mockServer.respondTo(this.method, this.path, (responder) => {
      responder.withJson(json)
    })
  }

  withHandler (handler) {
    this.constructionCompletedChecker()
    this.mockServer.respondTo(this.method, this.path, (responder) => {
      responder.withHandler(handler)
    })
  }
}

export class Responder {
  constructor (pendingRequst) {
    this.request = pendingRequst
  }

  withJson (json) {
    this.withHandler((req, res) => {
      res.json(json)
    })
  }

  withHandler (handler) {
    this.request.handled = true
    handler(this.request.req, this.request.res)
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
  constructor ({configCallback = defaultConfigCallback, staticPath, requestWindow = 64, requestTimeout = 100} = {}) {
    const app = express()
    configCallback(app)
    if (staticPath) {
      app.use(express.static(staticPath))
    }

    this.requestBuffer = new RequestBuffer(requestWindow, this.unhandledRequestHandler.bind(this))
    this.pendingResponders = []
    this.server = http.createServer(app).listen()
    this.port = this.server.address().port
    this.requestTimeout = requestTimeout

    app.set('port', this.port)
    app.all('*', this.storeRequestForLaterHandling.bind(this))
  }

  storeRequestForLaterHandling (req, res) {
    const pendingRequest = new PendingRequest(req, res)
    this.requestBuffer.push(pendingRequest)
    setTimeout(() => {
      if (!pendingRequest.handled) {
        this.unhandledRequestHandler(pendingRequest)
      }
    }, this.requestTimeout)
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
