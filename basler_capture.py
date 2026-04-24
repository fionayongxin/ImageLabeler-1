from pypylon import pylon
import cv2
import time
from pathlib import Path

PHOTOS_DIR = Path("photos")
PHOTOS_DIR.mkdir(exist_ok=True)

camera = pylon.InstantCamera(
    pylon.TlFactory.GetInstance().CreateFirstDevice()
)
camera.Open()

converter = pylon.ImageFormatConverter()
converter.OutputPixelFormat = pylon.PixelType_BGR8packed

camera.StartGrabbing(1)
grab = camera.RetrieveResult(3000)

image = converter.Convert(grab)
frame = image.GetArray()

filename = f"photo_{int(time.time()*1000)}.png"
cv2.imwrite(str(PHOTOS_DIR / filename), frame)

grab.Release()
camera.StopGrabbing()
camera.Close()

print(filename)
