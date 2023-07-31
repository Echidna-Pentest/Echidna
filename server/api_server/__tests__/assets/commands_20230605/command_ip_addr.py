#!/usr/bin/python3 -u

# [Echidna]
# name: ip address
# template: ip addr
# pattern: ip a.*
# [end]

import sys
import re
import ipaddress
from lib_command import LinesReader, node_host

INTERFACE = re.compile(r'\d+: .*:')
ETHER = re.compile(r'\s+link/ether ')
INET = re.compile(r'\s+inet ')
INET6 = re.compile(r'\s+inet6 ')


def main(lines):
    for addr in addresses(LinesReader(lines)):
        print('local', *addr, sep='\t')


def addresses(lines):
    for line in lines:
        yield from interfaces(line, lines)


def interfaces(line, lines):
    if not INTERFACE.match(line):
        return
    _, adapter, *_ = line.split()
    interface = ['interface', adapter.rstrip(':')]
    for line in lines:
        if INTERFACE.match(line):
            lines.unget(line)
            return
        yield from ether(line, lines, interface)


def ether(line, lines, interface):
    if not ETHER.match(line):
        return
    _, mac, *_ = line.split()
    yield 'mac', mac
    yield *interface, 'mac', mac
    for line in lines:
        if INTERFACE.match(line) or ETHER.match(line):
            lines.unget(line)
            return
        if INET.match(line):
            _, network, *_ = line.split()
            inet = ipaddress.ip_interface(network)
            if inet.is_global or inet.is_private and not inet.is_link_local:
                yield 'network', inet.network
            yield 'ipv4', inet.ip, 'netmask', inet.netmask
            yield *interface, 'ipv4', inet.ip
        elif INET6.match(line):
            _, network, *_ = line.split()
            inet = ipaddress.ip_interface(network)
            if inet.is_global or inet.is_private and not inet.is_link_local:
                yield 'network', inet.network
            yield 'ipv6', inet.ip, 'netmask', inet.netmask
            yield *interface, 'ipv6', inet.ip

if __name__ == '__main__':
    main(sys.stdin)
