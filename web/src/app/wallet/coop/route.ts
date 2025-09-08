export function GET() {
    return new Response(null, {
      status: 204,
      headers: { "Cross-Origin-Opener-Policy": "same-origin" },
    });
  }
  