#!/usr/bin/python3 -u

# [Echidna]
# name: ip neighbor
# template: ip neigh
# template: ip -4 neigh
# pattern: ip (-4 )*n.*
# [end]

import sys
import re
import ipaddress
from lib_command import type_address

MAC = re.compile(r'([\da-f]{2}:){5}[\da-f]{2}')


def main(lines):
    for target in targets(lines):
        print('remote', *target, sep='\t')


def targets(lines):
    for line in lines:
        items = line.rstrip().split()
        if len(items) < 3:
            continue
        host, dev, adapter, *items = items
        if dev != 'dev':
            continue
        host = type_address(host)
        if len(items) >= 2 and items[0] == 'lladdr':
            yield *host, 'mac', items[1]
        else:
            yield host


if __name__ == '__main__':
    main(sys.stdin)
