const detectContentType = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Range: "bytes=0-0",
    },
    redirect: "follow",
  });

  try {
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/pdf")) {
      return "pdf";
    }

    if (contentType?.includes("text/html")) {
      return "html";
    }

    return "unknown";
  } finally {
    await response.body?.cancel();
  }
};

export default detectContentType;
