import ipaddress


class LinesReader:

    def __init__(self, stream):
        self.stream = stream
        self.line = None

    def __iter__(self):
        return self

    def __next__(self):
        if self.line is not None:
            line, self.line = self.line, None
            return line
        return next(self.stream)

    def __bool__(self):
        return bool(self.fetch())

    def fetch(self):
        if self.line is not None:
            return self.line
        try:
            self.line = next(self.stream)
            return self.line
        except StopIteration:
            return ''

    def unget(self, line):
        if self.line is not None:
            raise OverflowError('existing unget line')
        self.line = line

    def find(self, matcher):
        for line in self:
            if matcher(line):
                return line

    def search(self, pattern):
        for line in self:
            if match := pattern.search(line):
                return match


def type_address(address):
    try:
        addr = ipaddress.ip_address(address)
        if addr.version == 4:
            return 'ipv4', address
        if addr.version == 6:
            return 'ipv6', address
        else:
            return 'ip', address
    except ValueError:
        return 'host', address


def is_host(address):
    try:
        addr = ipaddress.ip_address(address)
        return addr.is_private or addr.is_global
    except ValueError:
        return False


def node_host(nodes):
    values = dict(zip(nodes[::2], nodes[1::2]))
    for name in 'ipv4', 'ipv6':
        if name in values:
            address = values[name]
            if is_host(address):
                return name, address
    return None
