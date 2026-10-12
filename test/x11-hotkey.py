"""Inject a Ctrl+Shift shortcut on the isolated X11 display for desktop testing."""
import ctypes
import ctypes.util
import sys

x11 = ctypes.CDLL(ctypes.util.find_library('X11'))
xtest = ctypes.CDLL(ctypes.util.find_library('Xtst'))
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_uint
xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
display = x11.XOpenDisplay(None)
if not display:
    raise RuntimeError('No test X11 display available')
try:
    keys = [b'Control_L', b'Shift_L', sys.argv[1].encode()]
    codes = [x11.XKeysymToKeycode(display, x11.XStringToKeysym(key)) for key in keys]
    if not all(codes):
        raise RuntimeError('Unsupported test key')
    for code in codes:
        xtest.XTestFakeKeyEvent(display, code, True, 0)
    for code in reversed(codes):
        xtest.XTestFakeKeyEvent(display, code, False, 0)
    x11.XFlush(display)
finally:
    x11.XCloseDisplay(display)
