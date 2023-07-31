#!/usr/bin/python3 -u

# [Echidna]
# pattern: ping *
# name: test the reachability of a host on an Internet Protocol network
# template: ping {host}
# template: ping {ipv4}
# group: USEFUL COMMAND
# [end]

import re
import sys
from lib_command import LinesReader, type_address

hostname = ""
log = open('/dev/null', 'w')


def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')
#        debug.close()


# extract hostname or ip address
def extract_info(input_string):
    #    print("input_string=", input_string)
    # if both hostname and IPaddress exists extract hostname only
    host_match = re.search(
        r'from ([a-zA-Z0-9\-_]+) \((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)', input_string)
    if host_match:
        return host_match.group(1)

    # extract IPaddress
    ip_match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', input_string)
    if ip_match:
        return ip_match.group(0)

    return None


def targets(lines):
    for line in lines:
        #      print("line=", line)
        # skip if the host is Unreachable
        if "Unreachable" in line:
            continue
        if "icmp_seq" not in line:
            continue
        host = extract_info(line)
        if host is None:
            continue
        else:
            yield type_address(host)


if __name__ == '__main__':
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
