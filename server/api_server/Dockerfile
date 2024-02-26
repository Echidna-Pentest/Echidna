FROM kalilinux/kali-rolling

WORKDIR /root

RUN apt-get -y update && DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get -y dist-upgrade
RUN DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get -y install kali-linux-headless nodejs npm
RUN npm install n -g && n node/18.19.1
RUN DEBIAN_FRONTEND=noninteractive apt-get -y purge nodejs npm && apt-get -y autoremove && apt-get clean

WORKDIR /opt/app

COPY . .
RUN mkdir data
RUN npm install -g npm@latest
RUN npm install

EXPOSE 8888
EXPOSE 8889
CMD ["npm", "start"]
