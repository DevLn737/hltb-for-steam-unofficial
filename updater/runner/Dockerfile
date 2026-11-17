FROM node:22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        jq \
        python3 \
        python3-venv \
    && python3 -m venv /opt/hltb-venv \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/hltb-venv/bin:${PATH}"
