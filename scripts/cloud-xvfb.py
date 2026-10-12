"""Prepare an isolated virtual display for desktop smoke tests on Debian 13 cloud."""
import hashlib
import lzma
from pathlib import Path
import subprocess
import urllib.request

root = Path(__file__).resolve().parent.parent
binary = root / '.cache/xvfb/usr/bin/Xvfb'
if not binary.exists():
    index_url = 'https://deb.debian.org/debian/dists/trixie/main/binary-amd64/Packages.xz'
    with urllib.request.urlopen(index_url, timeout=60) as response:
        packages = lzma.decompress(response.read()).decode()
    entry = next(e for e in packages.split('\n\n') if e.startswith('Package: xvfb\n'))
    fields = dict(line.split(': ', 1) for line in entry.splitlines() if ': ' in line and not line.startswith(' '))
    with urllib.request.urlopen('https://deb.debian.org/debian/' + fields['Filename'], timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != fields['SHA256']:
        raise RuntimeError('Debian artifact checksum mismatch')
    package = root / '.cache/xvfb.deb'
    package.parent.mkdir(parents=True, exist_ok=True)
    package.write_bytes(data)
    subprocess.run(['dpkg-deb', '-x', str(package), str(root / '.cache/xvfb')], check=True)
    package.unlink()
print('Virtual display binary ready:', binary)
