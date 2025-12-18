import { DevtoolsWebSocketConnector } from '@ledgerhq/device-management-kit-devtools-websocket-connector'
import { Dashboard } from '@ledgerhq/device-management-kit-devtools-ui'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_DASHBOARD_WS_URL } from '@ledgerhq/device-management-kit-devtools-websocket-common'

function App(): React.JSX.Element {
  const [connector, setConnector] = useState<DevtoolsWebSocketConnector | null>(null)

  const connectorInitialized = useRef(false)
  useEffect(() => {
    if (connectorInitialized.current) {
      return
    }
    const connector = DevtoolsWebSocketConnector.getInstance().connect({
      url: DEFAULT_DASHBOARD_WS_URL
    })
    setConnector(connector)
    connectorInitialized.current = true
  }, [])

  if (!connector) {
    return <h3>Connector loading...</h3>
  }

  return (
    <>
      <Dashboard connector={connector} />
    </>
  )
}

export default App
