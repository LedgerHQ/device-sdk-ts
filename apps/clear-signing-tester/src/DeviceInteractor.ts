import axios from 'axios';

// Configuration
const SPECULOS_URL = process.env['SPECULOS_URL'] || 'http://localhost:5001';

export async function rejectTxOnDevice() {
  console.log('Rejecting transaction on device');
  await new Promise(resolve => setTimeout(resolve, 1000));

   //Touch Reject button on device
  await axios.post(`${SPECULOS_URL}/finger`, {
    "action":"press-and-release",
    "x": 80,
    "y": 620
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  //Confirm on device
  await axios.post(`${SPECULOS_URL}/finger`, {
    "action":"press-and-release",
    "x": 200,
    "y": 550
  });

  return true;
}

export async function rejectTxCheck() {
  console.log('Rejecting tx checks optin');
  await new Promise(resolve => setTimeout(resolve, 1000));

  //Confirm on device
  await axios.post(`${SPECULOS_URL}/finger`, {
    "action":"press-and-release",
    "x": 200,
    "y": 620
  });

  return true;
}

export async function ackBlindSignOnDevice(){
  console.log('Acknowledging blind sign');
  await new Promise(resolve => setTimeout(resolve, 2000));

  //Confirm on device
  await axios.post(`${SPECULOS_URL}/finger`, {
    "action":"press-and-release",
    "x": 200,
    "y": 620
  });

  return true;
} 