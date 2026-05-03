cmake_minimum_required(VERSION 3.16)

project(plasma-citygrow_debug)

set(PLASMA_VERSION "6.0.0")
set(QT_MIN_VERSION "6.6.0")
set(KF6_MIN_VERSION "6.0.0")

find_package(ECM ${KF6_MIN_VERSION} REQUIRED NO_MODULE)
set(CMAKE_MODULE_PATH ${ECM_MODULE_PATH})
find_package(KF6 ${KF6_MIN_VERSION} REQUIRED)
find_package(Plasma ${PLASMA_VERSION} REQUIRED)

plasma_install_package(package org.vitosotdihaet.citygrow_d.d.bac wallpapers wallpaper)
