/* global describe, test, expect */
import fetch from 'node-fetch'
import withMockServer from './index'

const getResponseJson = async (resultFuture) => (await resultFuture).json()

describe('SyncMockServer', () => {
  test('json response', async () => {
    await withMockServer({}, async (mockServer) => {
      const resultFuture = fetch(mockServer.url('/example'))

      mockServer.respondTo('GET', '/example').withJson({hello: 'world'})

      const response = await getResponseJson(resultFuture)
      expect(response).toEqual({hello: 'world'})
    })
  })
})
