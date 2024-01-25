console.info('WebHID API tester');

// Action: try to uncomment the following and see the error you get
// A `requestDevice` can only be called in the context of a user interaction.
// startWebHid();

document.getElementById('startButton').addEventListener('click', function() {
  startWebHid();
});

async function startWebHid() {
  if (!("hid" in navigator)) {
    console.warn("WebHID API not supported :'(");
    return;
  }

  console.info("WebHID API supported !");

  // Get all devices the user has previously granted the website access to.
  const prevGrantedDevices = await navigator.hid.getDevices();
  console.info(`Devices previously granted access: ${prevGrantedDevices.length} devices\n: ${prevGrantedDevices.map(d => d.productName).join(', ')}`);

  // Prompt user to select a device
  console.info("Requesting user to select a device...");
  let devices;

  // Action: try to set on Chrome "Don't allow sites to connect to HID devices" 
  // and remove any permission access to `file:///`  (this website) and see what happens 
  // -> on my MacOS with Chrome no error is thrown and the `devices` array is empty
  try {
    devices =  await navigator.hid.requestDevice({ filters: [{ vendorId: 0x2c97 }] });
  } catch (error) {
    console.error(`Error requesting device: ${error}`, error);
    return;
  }

  if (devices.length === 0) {
    console.warn("User didn't select any device.");
    return;
  }

  const device = devices[0];
  console.info(`User selected: ${device.productName}. Collections attributes: ${device.collections.length}`);

  for (let collection of device.collections) {
    console.log(`Collection:`);
    // An HID collection includes usage, usage page, reports, and subcollections.
    console.log(`--- Usage: ${collection.usage}`);
    console.log(`--- Usage page: ${collection.usagePage}`);
  
    console.log(`--- Input reports: ${collection.inputReports.length}`);
    for (let inputReport of collection.inputReports) {
      console.log(`--- Input report id: ${inputReport.reportId}`);
    }
  
    console.log(`--- Output reports: ${collection.outputReports.length}`);
    for (let outputReport of collection.outputReports) {
      console.log(`--- Output report id: ${outputReport.reportId}`);
    }

    console.log(`--- Feature reports: ${collection.featureReports.length}`);
    for (let featureReport of collection.featureReports) {
      console.log(`--- Feature report id: ${featureReport.reportId}`);
    }
  }

  console.log(`Opening device ${device.productName} ...`);
  try {
    await device.open();
  } catch (error) {
    if (error instanceof DOMException && error.name === "InvalidStateError") {
      console.info(`Device ${device.productName} is already open`);
    } else {
      console.error(`Error while opening device: ${error}`, error);
      return
    }
  }

  device.addEventListener("inputreport", event => { 
    const { data, device, reportId } = event; 
    const response = (new Uint8Array(data.buffer)).map(x => x.toString(16)).join(' ');
    console.log(`Received an input report on ${reportId}: ${response}`);
  });

  console.log(`Sending getVersion to device ${device.productName} ...`);
  try {
    await device.sendReport(0, new Uint8Array([0xAA, 0xAA, 0x05, 0x00, 0x00,0x00,0x05,0xE0,0x01,0x00,0x00,0x00]));
    console.log("getVersion sent");
  } catch (error) {
    console.error(`Error while sending getVersion: ${error}`, error);
    return;
  }
}

// Action: try to unplug and plug back the device and see the events in the console
if ("hid" in navigator) {
  navigator.hid.addEventListener("connect", event => {
    const { device } = event
    console.log(`📡 Received a connect event on ${device.productName}`);
  });

  navigator.hid.addEventListener("disconnect", event => {
    const { device } = event
    console.log(`📡 Received a disconnect event on ${device.productName}`);
  });
}
