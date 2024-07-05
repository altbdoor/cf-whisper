const corsHeaders = {
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Origin": "*",
};

export default {
  /** @param {Request} request */
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...corsHeaders } });
    }

    if (request.method !== "POST") {
      return new Response("No file uploaded", {
        status: 400,
        headers: { ...corsHeaders },
      });
    }

    try {
      const formData = await request.formData();
      const file = /** @type {File} */ (formData.get("file"));

      if (!file) {
        return new Response("No file uploaded", {
          status: 400,
          headers: { ...corsHeaders },
        });
      }

      const buffer = await file.arrayBuffer();

      // https://developers.cloudflare.com/workers-ai/models/#automatic-speech-recognition
      const model = "@cf/openai/whisper";
      const response = await env.AI.run(model, {
        audio: [...new Uint8Array(buffer)],
      });

      return Response.json(response, { headers: { ...corsHeaders } });
    } catch (err) {
      console.error("Error processing request:", err);
      return new Response("Internal server error", {
        status: 500,
        headers: { ...corsHeaders },
      });
    }
  },
};
