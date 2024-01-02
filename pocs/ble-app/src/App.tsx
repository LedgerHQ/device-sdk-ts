import './App.css';
import {useCallback, useState} from "react";

function App() {
    const [devices, setDevices] = useState<ReadonlyArray<BluetoothDevice>>([]);
    const [getDeviceError, setGetDeviceError] = useState<string>("");
    const [requestDeviceError, setRequestDeviceError] = useState<string>("");

    const requestDevice = useCallback(async () => {
        try {
            setRequestDeviceError("");
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true
            });
            setDevices([device])
        } catch (error) {
            setRequestDeviceError((error as Error).message);
            setDevices([]);
            console.error(error);
        }
    }, [])

    const getDevices = useCallback(async () => {
        try {
            setGetDeviceError("");
            const devices = await navigator.bluetooth.getDevices();
            setDevices(devices);
            if (!devices.length) {
                throw new Error("getDevices got 0 devices");
            }
        } catch (error) {
            setGetDeviceError((error as Error).message);
            setDevices([]);
            console.error(error);
            await requestDevice();
        }
    }, [])
    return (
        <div className="App">
            <header className="App-header">
                <a
                    className="App-link"
                    onClick={getDevices}
                    href="#"
                    rel="noopener noreferrer"
                >
                    Discover BLE devices
                </a>
                {
                    getDeviceError && (
                        <span className="error">{getDeviceError}</span>
                    )
                }
                {
                    requestDeviceError && (
                        <span className="error">{requestDeviceError}</span>
                    )
                }
                {
                    devices.length > 0 && (
                        <ul>
                            <span>Bluetooth devices discover result:</span>
                            {devices.map(device => (
                                    <li key={device.id}>{`${device.name} [${device.id}] ${device.gatt?.connected}`}</li>
                                )
                            )}
                        </ul>
                    )
                }
            </header>
        </div>
    );
}

export default App;
