// https://stackoverflow.com/a/70632277
export const getWorklet = () =>
  URL.createObjectURL(
    new Blob(
      [
        "(",
        function () {
          class RecorderProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.buffers = [];
            }

            process(inputs, outputs, parameters) {
              const input = inputs[0];
              const channelData = input[0];

              if (channelData) {
                const fixedData = new Float32Array(channelData.length);
                for (let i = 0; i < channelData.length; i++) {
                  fixedData[i] = channelData[i] * 32767.5;
                }

                this.port.postMessage(fixedData);
              }

              return true;
            }
          }

          registerProcessor("recorder-processor", RecorderProcessor);
        }.toString(),
        ")()",
      ],
      { type: "application/javascript" },
    ),
  );
