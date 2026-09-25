# shawty's playground

a lil play ground for my booboo 🌸

A tiny 2D pixel lobby: a bright meadow full of flowers where you walk around as
the girl, and the boy wanders on his own, picks flowers now and then, and brings
them to her.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or run it with Streamlit:

```sh
pip install -r requirements.txt
streamlit run streamlit_app.py
```

To put it online, deploy `streamlit_app.py` on
[Streamlit Community Cloud](https://share.streamlit.io).

Controls: **WASD** (or arrow keys) to walk.

## Files

- `index.html`, `game.js`: the game (plain JavaScript, no build step).
- `assets/girl.png`, `assets/boy.png`: game-ready sprite sheets (40x60 frames).
- `assets/source/`: the original AI-generated character art.
- `streamlit_app.py`: Streamlit wrapper that embeds the game.
- `tools/build_sprites.py`: turns the green-screen sheets in `assets/source/`
  into the game sprite sheets. Re-run it after replacing the source art
  (`pip install pillow numpy`, then `python3 tools/build_sprites.py`).

The meadow, trees, pond, flowers, butterflies and hearts are drawn in code.
