#!/usr/bin/env python3
"""Create exact platform cover crops from approved PNG source images.

The implementation uses only the Python standard library so the skill can run
in a clean environment without Pillow or ImageMagick.
"""

from __future__ import annotations

import argparse
import binascii
import math
from pathlib import Path
import struct
import sys
import zlib


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
TARGETS = (
    ("cover-wechat-primary-900x383.png", 900, 383, "master"),
    ("cover-wechat-secondary-500x500.png", 500, 500, "square"),
    ("cover-x-article-1920x368.png", 1920, 368, "x"),
    ("cover-zhihu-1380x560.png", 1380, 560, "master"),
)
CHANNELS_BY_COLOR_TYPE = {0: 1, 2: 3, 4: 2, 6: 4}


def unit_interval(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("value must be between 0 and 1")
    return parsed


def paeth(left: int, above: int, upper_left: int) -> int:
    prediction = left + above - upper_left
    left_distance = abs(prediction - left)
    above_distance = abs(prediction - above)
    upper_left_distance = abs(prediction - upper_left)
    if left_distance <= above_distance and left_distance <= upper_left_distance:
        return left
    if above_distance <= upper_left_distance:
        return above
    return upper_left


def read_png(path: Path) -> tuple[int, int, bytes]:
    payload = path.read_bytes()
    if not payload.startswith(PNG_SIGNATURE):
        raise ValueError(f"Only PNG sources are supported: {path}")

    offset = len(PNG_SIGNATURE)
    width = height = bit_depth = color_type = interlace = None
    compressed_parts: list[bytes] = []

    while offset < len(payload):
        if offset + 12 > len(payload):
            raise ValueError(f"Truncated PNG chunk in {path}")
        length = struct.unpack(">I", payload[offset : offset + 4])[0]
        chunk_type = payload[offset + 4 : offset + 8]
        start = offset + 8
        end = start + length
        chunk_data = payload[start:end]
        stored_crc = struct.unpack(">I", payload[end : end + 4])[0]
        actual_crc = binascii.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
        if stored_crc != actual_crc:
            raise ValueError(f"CRC mismatch in {path}: {chunk_type!r}")

        if chunk_type == b"IHDR":
            (
                width,
                height,
                bit_depth,
                color_type,
                compression,
                filter_method,
                interlace,
            ) = struct.unpack(">IIBBBBB", chunk_data)
            if compression != 0 or filter_method != 0:
                raise ValueError(f"Unsupported PNG encoding in {path}")
        elif chunk_type == b"IDAT":
            compressed_parts.append(chunk_data)
        elif chunk_type == b"IEND":
            break
        offset = end + 4

    if None in (width, height, bit_depth, color_type, interlace):
        raise ValueError(f"Missing PNG header in {path}")
    if bit_depth != 8 or interlace != 0:
        raise ValueError(
            f"PNG must be non-interlaced 8-bit color: {path} "
            f"(bit depth {bit_depth}, interlace {interlace})"
        )
    if color_type not in CHANNELS_BY_COLOR_TYPE:
        raise ValueError(f"Unsupported PNG color type {color_type} in {path}")

    channels = CHANNELS_BY_COLOR_TYPE[color_type]
    stride = width * channels
    inflated = zlib.decompress(b"".join(compressed_parts))
    expected = (stride + 1) * height
    if len(inflated) != expected:
        raise ValueError(
            f"Unexpected decoded PNG length in {path}: "
            f"got {len(inflated)}, expected {expected}"
        )

    decoded = bytearray(width * height * channels)
    previous = bytearray(stride)
    source_offset = 0
    destination_offset = 0

    for _ in range(height):
        filter_type = inflated[source_offset]
        source_offset += 1
        row = bytearray(inflated[source_offset : source_offset + stride])
        source_offset += stride

        for index in range(stride):
            left = row[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                row[index] = (row[index] + left) & 0xFF
            elif filter_type == 2:
                row[index] = (row[index] + above) & 0xFF
            elif filter_type == 3:
                row[index] = (row[index] + ((left + above) // 2)) & 0xFF
            elif filter_type == 4:
                row[index] = (
                    row[index] + paeth(left, above, upper_left)
                ) & 0xFF
            elif filter_type != 0:
                raise ValueError(f"Unsupported PNG filter {filter_type} in {path}")

        decoded[destination_offset : destination_offset + stride] = row
        destination_offset += stride
        previous = row

    if color_type == 2:
        return width, height, bytes(decoded)

    rgb = bytearray(width * height * 3)
    for pixel_index in range(width * height):
        source_index = pixel_index * channels
        target_index = pixel_index * 3
        if color_type == 0:
            gray = decoded[source_index]
            rgb[target_index : target_index + 3] = bytes((gray, gray, gray))
        elif color_type == 4:
            gray, alpha = decoded[source_index : source_index + 2]
            composited = round((gray * alpha + 255 * (255 - alpha)) / 255)
            rgb[target_index : target_index + 3] = bytes(
                (composited, composited, composited)
            )
        else:
            red, green, blue, alpha = decoded[source_index : source_index + 4]
            rgb[target_index] = round(
                (red * alpha + 255 * (255 - alpha)) / 255
            )
            rgb[target_index + 1] = round(
                (green * alpha + 255 * (255 - alpha)) / 255
            )
            rgb[target_index + 2] = round(
                (blue * alpha + 255 * (255 - alpha)) / 255
            )
    return width, height, bytes(rgb)


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    checksum = binascii.crc32(chunk_type + data) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", checksum)
    )


def write_rgb_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    stride = width * 3
    scanlines = bytearray((stride + 1) * height)
    source_offset = 0
    destination_offset = 0
    for _ in range(height):
        scanlines[destination_offset] = 0
        destination_offset += 1
        scanlines[destination_offset : destination_offset + stride] = pixels[
            source_offset : source_offset + stride
        ]
        source_offset += stride
        destination_offset += stride

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    encoded = (
        PNG_SIGNATURE
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9))
        + png_chunk(b"IEND", b"")
    )
    path.write_bytes(encoded)


def crop_geometry(
    source_width: int,
    source_height: int,
    target_width: int,
    target_height: int,
    focal_x: float,
    focal_y: float,
) -> tuple[int, int, int, int]:
    source_ratio = source_width / source_height
    target_ratio = target_width / target_height
    if source_ratio > target_ratio:
        crop_height = source_height
        crop_width = round(crop_height * target_ratio)
    else:
        crop_width = source_width
        crop_height = round(crop_width / target_ratio)

    left = round(focal_x * source_width - crop_width / 2)
    top = round(focal_y * source_height - crop_height / 2)
    left = max(0, min(left, source_width - crop_width))
    top = max(0, min(top, source_height - crop_height))
    return left, top, crop_width, crop_height


def resize_cover(
    source_width: int,
    source_height: int,
    source_pixels: bytes,
    target_width: int,
    target_height: int,
    focal_x: float,
    focal_y: float,
) -> bytes:
    left, top, crop_width, crop_height = crop_geometry(
        source_width,
        source_height,
        target_width,
        target_height,
        focal_x,
        focal_y,
    )

    x_samples: list[tuple[int, int, float]] = []
    for target_x in range(target_width):
        source_x = left + ((target_x + 0.5) * crop_width / target_width) - 0.5
        source_x = max(left, min(source_x, left + crop_width - 1))
        first = math.floor(source_x)
        second = min(first + 1, left + crop_width - 1)
        x_samples.append((first, second, source_x - first))

    y_samples: list[tuple[int, int, float]] = []
    for target_y in range(target_height):
        source_y = top + ((target_y + 0.5) * crop_height / target_height) - 0.5
        source_y = max(top, min(source_y, top + crop_height - 1))
        first = math.floor(source_y)
        second = min(first + 1, top + crop_height - 1)
        y_samples.append((first, second, source_y - first))

    output = bytearray(target_width * target_height * 3)
    output_offset = 0
    source_stride = source_width * 3
    for first_y, second_y, y_weight in y_samples:
        first_row = first_y * source_stride
        second_row = second_y * source_stride
        inverse_y = 1 - y_weight
        for first_x, second_x, x_weight in x_samples:
            first_offset = first_x * 3
            second_offset = second_x * 3
            inverse_x = 1 - x_weight
            for channel in range(3):
                top_value = (
                    source_pixels[first_row + first_offset + channel] * inverse_x
                    + source_pixels[first_row + second_offset + channel] * x_weight
                )
                bottom_value = (
                    source_pixels[second_row + first_offset + channel] * inverse_x
                    + source_pixels[second_row + second_offset + channel] * x_weight
                )
                output[output_offset] = round(
                    top_value * inverse_y + bottom_value * y_weight
                )
                output_offset += 1
    return bytes(output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Crop and resize approved PNG cover sources to exact WeChat "
            "primary/secondary, X Articles, and Zhihu dimensions without "
            "stretching."
        )
    )
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument(
        "--x-source",
        type=Path,
        help="Optional X-specific reflow PNG; defaults to the master.",
    )
    parser.add_argument(
        "--square-source",
        type=Path,
        help="Optional square WeChat reflow PNG; defaults to the master.",
    )
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--focal-x", type=unit_interval, default=0.5)
    parser.add_argument("--focal-y", type=unit_interval, default=0.5)
    parser.add_argument("--x-focal-x", type=unit_interval)
    parser.add_argument("--x-focal-y", type=unit_interval)
    parser.add_argument("--square-focal-x", type=unit_interval)
    parser.add_argument("--square-focal-y", type=unit_interval)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing platform files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    x_source_path = args.x_source or args.master
    square_source_path = args.square_source or args.master
    for source_path in dict.fromkeys(
        (args.master, x_source_path, square_source_path)
    ):
        if not source_path.is_file():
            print(f"Source image not found: {source_path}", file=sys.stderr)
            return 2

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_paths = [args.output_dir / target[0] for target in TARGETS]
    existing = [path for path in output_paths if path.exists()]
    if existing and not args.overwrite:
        joined = "\n".join(str(path) for path in existing)
        print(
            "Refusing to overwrite existing covers. Use --overwrite or a "
            f"versioned output directory:\n{joined}",
            file=sys.stderr,
        )
        return 3

    master = read_png(args.master)
    x_source = master if x_source_path == args.master else read_png(x_source_path)
    square_source = (
        master
        if square_source_path == args.master
        else read_png(square_source_path)
    )
    sources = {
        "master": master,
        "x": x_source,
        "square": square_source,
    }

    for filename, width, height, source_kind in TARGETS:
        source_width, source_height, source_pixels = sources[source_kind]
        if source_kind == "x":
            focal_x = (
                args.x_focal_x
                if args.x_focal_x is not None
                else args.focal_x
            )
            focal_y = (
                args.x_focal_y
                if args.x_focal_y is not None
                else args.focal_y
            )
        elif source_kind == "square":
            focal_x = (
                args.square_focal_x
                if args.square_focal_x is not None
                else args.focal_x
            )
            focal_y = (
                args.square_focal_y
                if args.square_focal_y is not None
                else args.focal_y
            )
        else:
            focal_x = args.focal_x
            focal_y = args.focal_y
        output_pixels = resize_cover(
            source_width,
            source_height,
            source_pixels,
            width,
            height,
            focal_x,
            focal_y,
        )
        output_path = args.output_dir / filename
        write_rgb_png(output_path, width, height, output_pixels)
        print(f"{output_path}\t{width}x{height}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
