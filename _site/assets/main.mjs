import { getWorklet } from "./audio-worklet.mjs";
import { beginRecording } from "./begin-recording.mjs";

const workletBlobUrl = getWorklet();
window.addEventListener("beforeunload", () =>
  URL.revokeObjectURL(workletBlobUrl),
);

document.addEventListener("alpine:init", () => {
  function root() {
    return {
      encoder: null,

      /** @type {string} */
      activeDeviceId: null,
      /** @type {{ id: string; label: string }[]} */
      devices: [],

      async init() {
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        this.devices = devices
          .filter((dev) => dev.kind === "audioinput")
          .map((dev) => ({
            id: dev.deviceId,
            label: `${dev.label} (${dev.deviceId})`,
          }));

        if (this.devices.length > 0) {
          this.activeDeviceId = this.devices[0].id;
        }

        window.addEventListener("beforeunload", () => {
          this.recordEntries.forEach((entry) => URL.revokeObjectURL(entry.url));
        });
      },

      isRecording: false,
      recordingTimeInterval: 0,
      recordingTime: "00:00",
      maxRecordingInSeconds: 90,

      /** @type {{ url: string; size: string, text: string, blob: Blob, time: string }[]} */
      recordEntries: [],
      /** @type {() => void} */
      streamStopCallback: null,

      /** @param {string} deviceId */
      async startRecord(deviceId) {
        if (!this.encoder) {
          let tmpAudioContext = new AudioContext();
          const sampleRate = tmpAudioContext.sampleRate;
          tmpAudioContext.close();
          tmpAudioContext = null;
          this.encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId },
        });
        this.streamStopCallback = await beginRecording(
          workletBlobUrl,
          stream,
          this.encoder,
        );
        this.isRecording = true;

        const startTime = Date.now();
        this.recordingTimeInterval = setInterval(() => {
          const totalSeconds = Math.floor((Date.now() - startTime) / 1000);

          if (totalSeconds > this.maxRecordingInSeconds) {
            this.stopRecord();
            return;
          }

          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;

          const formattedMinutes = `${minutes}`.padStart(2, "0");
          const formattedSeconds = `${seconds}`.padStart(2, "0");

          this.recordingTime = `${formattedMinutes}:${formattedSeconds}`;
        }, 500);
      },
      async stopRecord() {
        this.isRecording = false;

        clearInterval(this.recordingTimeInterval);
        this.recordingTime = "00:00";

        if (typeof this.streamStopCallback !== "function") {
          return;
        }

        const buffer = this.streamStopCallback();
        const lastBuffer = this.encoder.flush();
        if (lastBuffer.length > 0) {
          buffer.push(lastBuffer);
        }

        this.encoder = null;
        const blob = new Blob(buffer, { type: "audio/mp3" });
        this.recordEntries = [
          ...this.recordEntries,
          {
            url: URL.createObjectURL(blob),
            size: (blob.size / 1000 / 1000).toFixed(2),
            text: "",
            time: new Date().toLocaleString(),
            blob,
          },
        ];
      },

      isTranscribing: false,
      showHelpProxyUrl: false,
      proxyUrl: "",

      /**
       * @param {index} number
       * @param {string} proxyUrl
       */
      async transcribe(index, proxyUrl) {
        if (!proxyUrl) {
          alert("Please add a Cloudflare proxy URL");
          return;
        }

        this.isTranscribing = true;
        const form = new FormData();
        form.set("file", this.recordEntries[index].blob);

        const res = await fetch(proxyUrl, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          alert("Error while transcribing! Please check the proxy logs.");
          this.isTranscribing = false;
          return;
        }

        const data = await res.json();
        console.log(data);

        this.isTranscribing = false;
        this.recordEntries = this.recordEntries.map((entry, currentIndex) => {
          if (index === currentIndex) {
            return { ...entry, text: data.text };
          }

          return entry;
        });
      },
    };
  }

  Alpine.data("root", root);
});
