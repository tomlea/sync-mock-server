/* global describe, test, expect */
import fetch from 'node-fetch'
import withMockServer, {Responder, ResponderDSL} from './index'

const getResponseJson = async (resultFuture) => (await resultFuture).json()

const pauseFor = (time) =>
  new Promise((resolve) => setTimeout(resolve, time))

describe('SyncMockServer', () => {
  test('delayed response (the main thing we are after here)', async () => {
    await withMockServer({}, async (mockServer) => {
      const resultFuture = fetch(mockServer.url('/example'))
      let resolved = false
      resultFuture.then((v) => {
        resolved = true
        return v
      })

      await pauseFor(100)

      expect(resolved).toBeFalsy()

      mockServer.respondTo('GET', '/example').withJson({hello: 'world'})

      const response = await getResponseJson(resultFuture)

      expect(resolved).toBeTruthy()

      expect(response).toEqual({hello: 'world'})
    })
  })

  test('json response', async () => {
    await withMockServer({}, async (mockServer) => {
      const resultFuture = fetch(mockServer.url('/example'))

      mockServer.respondTo('GET', '/example').withJson({hello: 'world'})

      const response = await getResponseJson(resultFuture)
      expect(response).toEqual({hello: 'world'})
    })
  })

  test('handler response', async () => {
    await withMockServer({}, async (mockServer) => {
      const resultFuture = fetch(mockServer.url('/example'))

      mockServer.respondTo('GET', '/example').withHandler((req, res) => res.json({hello: 'world'}))

      const response = await getResponseJson(resultFuture)
      expect(response).toEqual({hello: 'world'})
    })
  })

  test('unhanded response', async () => {
    await withMockServer({}, async (mockServer) => {
      const response = await fetch(mockServer.url('/example'))
      expect(response.status).toEqual(501)
    })
  })

  test('unhanded response due to bad matcher', async () => {
    await withMockServer({}, async (mockServer) => {
      mockServer.respondTo('GET', '/example/bar').withJson({hello: 'world'})
      const response = await fetch(mockServer.url('/example'))
      expect(response.status).toEqual(501)
    })
  })

  test('unhanded response due to wrong method', async () => {
    await withMockServer({}, async (mockServer) => {
      mockServer.respondTo('POST', '/example').withJson({hello: 'world'})
      const response = await fetch(mockServer.url('/example'))
      expect(response.status).toEqual(501)
    })
  })
})

describe('ResponderDSL', () => {
  test('it had the same methods as a Responder', () => {
    expect(Object.getOwnPropertyNames(Responder.prototype)).toEqual(Object.getOwnPropertyNames(ResponderDSL.prototype))
  })

  test('it does not like it when we use the DSL wrong', async () => {
    await withMockServer({}, async (mockServer) => {
      const responderDSL = new ResponderDSL(mockServer)
      responderDSL.withJson({})
      expect(() => responderDSL.withJson({})).toThrow(new Error('You can only set one response in a single handler'))
    })
  })
})
