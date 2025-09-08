// Returns 204 with COOP so the SDK probe passes
export function GET() {
    return new Response(null, {
      status: 204,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
      },
    });
  }
  