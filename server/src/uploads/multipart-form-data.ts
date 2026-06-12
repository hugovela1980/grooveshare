export type MultipartFile = {
  fieldName: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  size: number;
};

export type ParsedMultipartFormData = {
  fields: Record<string, string>;
  files: MultipartFile[];
};

type ParseMultipartFormDataOptions = {
  contentType: string | undefined;
  body: Buffer;
};

function getBoundary(contentType: string | undefined): string {
  if (!contentType?.startsWith("multipart/form-data")) {
    throw new Error("Expected multipart/form-data content type.");
  }

  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Multipart boundary is missing.");
  }

  return boundary;
}

function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};

  const headerLines = headerText.split("\r\n");

  for (const headerLine of headerLines) {
    const separatorIndex = headerLine.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const name = headerLine.slice(0, separatorIndex).trim().toLowerCase();
    const value = headerLine.slice(separatorIndex + 1).trim();

    headers[name] = value;
  }

  return headers;
}

function getDispositionValue(
  contentDisposition: string,
  key: string,
): string | null {
  const match = contentDisposition.match(new RegExp(`${key}="([^"]*)"`));
  return match?.[1] ?? null;
}

export function parseMultipartFormData({
  contentType,
  body,
}: ParseMultipartFormDataOptions): ParsedMultipartFormData {
  const boundary = getBoundary(contentType);
  const delimiter = `--${boundary}`;

  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  const bodyText = body.toString("latin1");
  const rawParts = bodyText.split(delimiter);

  for (const rawPart of rawParts) {
    let part = rawPart;

    if (!part || part === "--\r\n" || part === "--" || part.trim() === "") {
      continue;
    }

    if (part.startsWith("--")) {
      continue;
    }

    if (part.startsWith("\r\n")) {
      part = part.slice(2);
    }

    if (part.endsWith("\r\n")) {
      part = part.slice(0, -2);
    }

    const headerEndIndex = part.indexOf("\r\n\r\n");

    if (headerEndIndex === -1) {
      continue;
    }

    const headerText = part.slice(0, headerEndIndex);
    const contentText = part.slice(headerEndIndex + 4);

    const headers = parseHeaders(headerText);
    const contentDisposition = headers["content-disposition"];

    if (!contentDisposition) {
      continue;
    }

    const fieldName = getDispositionValue(contentDisposition, "name");

    if (!fieldName) {
      continue;
    }

    const filename = getDispositionValue(contentDisposition, "filename");
    const contentBuffer = Buffer.from(contentText, "latin1");

    if (!filename) {
      fields[fieldName] = contentBuffer.toString("utf-8");
      continue;
    }

    files.push({
      fieldName,
      filename,
      mimeType: headers["content-type"] ?? "application/octet-stream",
      data: contentBuffer,
      size: contentBuffer.length,
    });
  }

  return {
    fields,
    files,
  };
}