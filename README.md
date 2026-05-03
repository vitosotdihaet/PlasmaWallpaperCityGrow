# PlasmaWallpaper_CityGrow
Plasma Wallpaper Plugin (also Screen Lock) with growing city animation

Simple animation which looks like growing cities. This was inspired from an old KDE3 wallpaper (sorry, I cannot remember the name). Also, I used the Game of Life wallpaper plugin as "tutorial" (thanks to user @jaapgeurts). 

New Feature: pause, when wallpaper is not visible (because of fullscreen or maximized windows). Huge inspiration taken from the [Smart Video Wallpaper](https://store.kde.org/p/1316299) by user ADHE.

## Building

```bash
mkdir build
cmake ..
make install # maybe need sudo
```

## TODOs

- [ ] wraparound rects between lines
- [ ] choose colors for lines
- [ ] choose bg color
