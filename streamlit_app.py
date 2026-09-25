"""Streamlit wrapper for the Flower Meadow game.

The game itself is plain HTML + JavaScript (index.html, game.js). This app
inlines the script and sprite images into one HTML page and embeds it.
"""
import base64
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

ROOT = Path(__file__).parent


def data_uri(path):
    return 'data:image/png;base64,' + base64.b64encode((ROOT / path).read_bytes()).decode()


@st.cache_data
def game_html():
    script = (ROOT / 'game.js').read_text()
    for name in ('girl', 'boy'):
        script = script.replace(f"'assets/{name}.png'", f"'{data_uri(f'assets/{name}.png')}'")
    html = (ROOT / 'index.html').read_text()
    return html.replace('<script src="game.js"></script>', f'<script>{script}</script>')


st.set_page_config(page_title="shawty's playground", page_icon='🌸', layout='wide')
st.markdown("<h2 style='text-align:center'>🌸 shawty's playground 🌸</h2>", unsafe_allow_html=True)
st.markdown("<p style='text-align:center'>Click the game, then walk with <b>WASD</b></p>", unsafe_allow_html=True)
components.html(game_html(), height=540)
