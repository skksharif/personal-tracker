import { NextResponse } from "next/server";

import {
  MAX_UPLOAD_BYTES,
  UploadError,
  deleteImage,
  saveImage,
} from "@/lib/storage/media";

/**
 * Image upload and deletion.
 *
 * A route handler rather than a Server Action because this streams binary
 * multipart data, which actions are a poor fit for.
 */

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file was included." },
        { status: 400 },
      );
    }

    // Checked again inside saveImage against the actual bytes; this is the
    // cheap rejection before reading the whole thing into memory.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Images must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`,
        },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const alt = form.get("alt");

    const media = await saveImage(bytes, file.name, "images", {
      alt: typeof alt === "string" ? alt : "",
    });

    return NextResponse.json({ media });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: "Couldn't save that image. Your entry is unaffected." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("path");

    if (!target) {
      return NextResponse.json({ error: "No path given." }, { status: 400 });
    }

    await deleteImage(target);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: "Couldn't delete that image." },
      { status: 500 },
    );
  }
}
