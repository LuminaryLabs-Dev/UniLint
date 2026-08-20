#!/usr/bin/env python3
"""Stdlib-only asset fact worker for UniLint."""
from __future__ import annotations
import argparse
import json
import os
import struct
import wave
from pathlib import Path


def png_size(path: Path):
    with path.open('rb') as f:
        header = f.read(24)
    if len(header) >= 24 and header[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', header[16:24])
    return None


def wav_info(path: Path):
    try:
        with wave.open(str(path), 'rb') as wav:
            return {
                'channels': wav.getnchannels(),
                'sampleRate': wav.getframerate(),
                'frames': wav.getnframes(),
                'seconds': wav.getnframes() / max(1, wav.getframerate()),
            }
    except (wave.Error, EOFError):
        return None


def binary_kind(path: Path):
    try:
        with path.open('rb') as f:
            magic = f.read(8)
    except OSError:
        return None
    if magic[:2] == b'MZ':
        return 'pe'
    if magic[:4] == b'\x7fELF':
        return 'elf'
    if magic[:4] in {b'\xfe\xed\xfa\xce', b'\xfe\xed\xfa\xcf', b'\xce\xfa\xed\xfe', b'\xcf\xfa\xed\xfe'}:
        return 'mach-o'
    return None


def inspect(root: Path):
    items = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {'.git', 'Library', 'Temp', 'Obj', 'Logs'}]
        for name in files:
            path = Path(base) / name
            rel = path.relative_to(root).as_posix()
            try:
                size = path.stat().st_size
            except OSError:
                continue
            fact = {'path': rel, 'bytes': size}
            suffix = path.suffix.lower()
            if suffix == '.png':
                dimensions = png_size(path)
                if dimensions:
                    fact['image'] = {'width': dimensions[0], 'height': dimensions[1], 'format': 'png'}
            elif suffix == '.wav':
                audio = wav_info(path)
                if audio:
                    fact['audio'] = audio
            if suffix in {'.dll', '.so', '.dylib'}:
                fact['binaryKind'] = binary_kind(path)
            items.append(fact)
    return {'schemaVersion': '0.1', 'root': str(root.resolve()), 'items': items}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('project')
    args = parser.parse_args()
    print(json.dumps(inspect(Path(args.project)), indent=2))


if __name__ == '__main__':
    main()
