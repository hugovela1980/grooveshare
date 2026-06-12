import { parseMultipartFormData } from "../src/uploads/multipart-form-data.js";
import { tester } from "./test-runner/tester.js";

function createMultipartBody({
    boundary,
    parts,
}: {
    boundary: string;
    parts: Buffer[];
}): Buffer {
    return Buffer.concat([
        ...parts,
        Buffer.from(`--${boundary}--\r\n`, "utf-8"),
    ]);
}

function createTextPart({
    boundary,
    name,
    value,
}: {
    boundary: string;
    name: string;
    value: string;
}): Buffer {
    return Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"\r\n` +
        `\r\n` +
        `${value}\r\n`,
        "utf-8",
    );
}

function createFilePart({
    boundary,
    fieldName,
    filename,
    mimeType,
    data,
}: {
    boundary: string;
    fieldName: string;
    filename: string;
    mimeType: string;
    data: Buffer;
}): Buffer {
    return Buffer.concat([
        Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
            `Content-Type: ${mimeType}\r\n` +
            `\r\n`,
            "utf-8",
        ),
        data,
        Buffer.from("\r\n", "utf-8"),
    ]);
}

tester.describe("multipart form data parser", () => {
    tester.it("parses text fields from a multipart body", () => {
        const boundary = "----GrooveShareBoundary";

        const body = createMultipartBody({
            boundary,
            parts: [
                createTextPart({
                    boundary,
                    name: "trackName",
                    value: "Guitar",
                }),
            ],
        });

        const parsedForm = parseMultipartFormData({
            contentType: `multipart/form-data; boundary=${boundary}`,
            body,
        });

        tester.expect(parsedForm.fields).toEqual({
            trackName: "Guitar",
        });

        tester.expect(parsedForm.files).toEqual([]);
    });

    tester.it("parses an uploaded file from a multipart body", () => {
        const boundary = "----GrooveShareBoundary";
        const fileData = Buffer.from("fake wav data", "utf-8");

        const body = createMultipartBody({
            boundary,
            parts: [
                createFilePart({
                    boundary,
                    fieldName: "audioFile",
                    filename: "guitar-riff.wav",
                    mimeType: "audio/wav",
                    data: fileData,
                }),
            ],
        });

        const parsedForm = parseMultipartFormData({
            contentType: `multipart/form-data; boundary=${boundary}`,
            body,
        });

        tester.expect(parsedForm.fields).toEqual({});
        tester.expect(parsedForm.files.length).toBe(1);

        const file = parsedForm.files[0];

        tester.expect(file.fieldName).toBe("audioFile");
        tester.expect(file.filename).toBe("guitar-riff.wav");
        tester.expect(file.mimeType).toBe("audio/wav");
        tester.expect(file.size).toBe(fileData.length);
        tester.expect(file.data.toString("utf-8")).toBe("fake wav data");
    });

    tester.it("parses text fields and uploaded files from the same multipart body", () => {
        const boundary = "----GrooveShareBoundary";
        const fileData = Buffer.from("fake mp3 data", "utf-8");

        const body = createMultipartBody({
            boundary,
            parts: [
                createTextPart({
                    boundary,
                    name: "trackName",
                    value: "Scratch Drums",
                }),
                createFilePart({
                    boundary,
                    fieldName: "audioFile",
                    filename: "scratch-drums.mp3",
                    mimeType: "audio/mpeg",
                    data: fileData,
                }),
            ],
        });

        const parsedForm = parseMultipartFormData({
            contentType: `multipart/form-data; boundary=${boundary}`,
            body,
        });

        tester.expect(parsedForm.fields).toEqual({
            trackName: "Scratch Drums",
        });

        tester.expect(parsedForm.files.length).toBe(1);
        tester.expect(parsedForm.files[0].filename).toBe("scratch-drums.mp3");
        tester.expect(parsedForm.files[0].mimeType).toBe("audio/mpeg");
    });

    tester.it("throws an error when the content type is not multipart form data", () => {
        let errorMessage = "";

        try {
            parseMultipartFormData({
                contentType: "application/json",
                body: Buffer.from("{}"),
            });
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }

        tester.expect(errorMessage).toBe("Expected multipart/form-data content type.");
    });

    tester.it("throws an error when the multipart boundary is missing", () => {
        let errorMessage = "";

        try {
            parseMultipartFormData({
                contentType: "multipart/form-data",
                body: Buffer.from(""),
            });
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }

        tester.expect(errorMessage).toBe("Multipart boundary is missing.");
    });
});