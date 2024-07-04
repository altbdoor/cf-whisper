// https://github.com/zhuker/lamejs/issues/10#issuecomment-150137964
export async function beginRecording(workletBlobUrl, stream, encoder) {
  const context = new AudioContext();
  await context.audioWorklet.addModule(workletBlobUrl);
  const microphone = context.createMediaStreamSource(stream);
  const recorderNode = new AudioWorkletNode(context, "recorder-processor");

  const buffers = [];

  recorderNode.port.onmessage = (event) => {
    const fixedData = event.data;
    const buffer = encoder.encodeBuffer(fixedData);
    buffers.push(buffer);
  };

  microphone.connect(recorderNode);
  recorderNode.connect(context.destination);

  return function stopRecording() {
    if (context.close) {
      context.close();
    }
    microphone.disconnect();
    recorderNode.disconnect();
    recorderNode.port.onmessage = null;

    return buffers;
  };
}
