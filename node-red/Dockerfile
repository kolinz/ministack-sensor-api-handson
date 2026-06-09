FROM nodered/node-red:latest
COPY flows.json /init/flows.json
COPY entrypoint.sh /entrypoint.sh
USER root
RUN chmod +x /entrypoint.sh
USER node-red
ENTRYPOINT ["/entrypoint.sh"]
