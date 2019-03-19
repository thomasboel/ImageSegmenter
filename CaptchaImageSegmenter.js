var Jimp = require('jimp');

const whiteColor = 4294967295;
const blueColor = 1251009279;

class CaptchaImageSegmenter {
  async segmentCaptcha(image) {
    await Jimp.read(image).then(async (img) => {
      // Captcha Segment
      let captchaFrame = await this.getCaptchaFrame(img);
      let captchaImage = img.clone().crop(captchaFrame.frameLeft, captchaFrame.frameTop, captchaFrame.frameWidth, img.bitmap.height - captchaFrame.frameTop);
      captchaImage.write('./testSubjects/captchaImage.png');

      // Instruction Box Segment
      let instructionFrame = await this.getInstructionBoxFrame(captchaImage);
      let instructionImage = captchaImage.clone().crop(instructionFrame.frameLeft, instructionFrame.frameTop, instructionFrame.frameWidth, instructionFrame.frameBottom - instructionFrame.frameTop);
      instructionImage.write('./testSubjects/instructionImage.png');

      // Tile Grid Segment
      let tileGridFrame = await this.getTileGridFrame(captchaImage, instructionFrame);
      let tileGridImage = captchaImage.clone().crop(tileGridFrame.frameLeft, tileGridFrame.frameTop, tileGridFrame.frameRight, tileGridFrame.frameRight);
      tileGridImage.write('./testSubjects/tileGrid.png');
    });
  }

  async getTileGridFrame(captchaImg, instructionFrame) {
    return await Jimp.read(captchaImg).then(async (img) => {
      // Assign the top by moving through the instruction box till the bottom edge is reached
      // Left and right edges are just the image edges
      // Go down the left edge until the bottom frame is reached
      let frameTopPos = await this.getColorChangedPosition(img, {x: instructionFrame.frameLeft, y: instructionFrame.frameBottom}, 'down', blueColor);
      let frameTop = frameTopPos.y;
      let frameLeft = 0;
      let frameRight = img.bitmap.width;
      let frameBottomPos = await this.getColorChangedPosition(img, {x: frameLeft, y: frameTop}, 'down', whiteColor);
      let frameBottom = frameBottomPos.y;

      return { frameTop, frameLeft, frameRight, frameBottom };
    });
  }

  async getInstructionBoxFrame(captchaImg) {
    return await Jimp.read(captchaImg).then(async (img) => {
      // Start from the top-middle and go down till the top of the instruction frame is found
      // Then find the edges by moving towards the middle until edges are found
      // Finally move from the left edge down till the bottom is found
      let frameTopPos = await this.getColorChangedPosition(img, {x: img.bitmap.width/2, y: 0}, 'down', whiteColor);
      let frameTop = frameTopPos.y;
      let frameLeftPos = await this.getColorChangedPosition(img, {x: 0, y: frameTop}, 'right', whiteColor);
      let frameLeft = frameLeftPos.x;
      let frameRightPos = await this.getColorChangedPosition(img, {x: img.bitmap.width, y: frameTop}, 'left', whiteColor);
      let frameRight = frameRightPos.x;
      let frameBottomPos = await this.getColorChangedPosition(img, {x: frameLeft, y: frameTop}, 'down', blueColor);
      let frameBottom = frameBottomPos.y;
      let frameWidth = img.bitmap.width - frameLeft - (img.bitmap.width - frameRight);

      return { frameTop, frameLeft, frameRight, frameWidth, frameBottom };
    })
  }

  async getCaptchaFrame(img) {
    return await Jimp.read(img).then(async (img) => {
      // Start from top-middle and go down till the top of the frame is found
      // Then find the edges by moving towards the middle until the edges are found
      let frameTopPos = await this.getColorChangedPosition(img, {x: img.bitmap.width/2, y: 0}, 'down', whiteColor);
      let frameTop = frameTopPos.y + 1; // +1 since we dont wan't the actual grey frame
      let frameLeftPos = await this.getColorChangedPosition(img, {x: 0, y: frameTop}, 'right', whiteColor);
      let frameLeft = frameLeftPos.x + 1; // +1 since we dont wan't the actual grey frame
      let frameRightPos = await this.getColorChangedPosition(img, {x: img.bitmap.width, y: frameTop}, 'left', whiteColor);
      let frameRight = frameRightPos.x;

      let frameWidth = (img.bitmap.width - frameLeft) - (img.bitmap.width - frameRight);

      return { frameTop, frameLeft, frameRight, frameWidth };
    });
  }

  async getColorChangedPosition(image, startPos, direction, color) {
    return await Jimp.read(image).then((img) => {
      if (direction == 'up') {
        for (let y = startPos.y; y > 0; y--) {
          if (img.getPixelColor(startPos.x, y) != color) {
            return { x: startPos.x, y: y };
          }
        }
      } else if (direction == 'down') {
        for (let y = startPos.y; y < img.bitmap.height; y++) {
          if (img.getPixelColor(startPos.x, y) != color) {
            return { x: startPos.x, y: y };
          }
        }
      } else if (direction == 'left') {
        for (let x = startPos.x; x > 0; x--) {
          if (img.getPixelColor(x, startPos.y) != color) {
            return { x: x, y: startPos.y };
          }
        }
      } else if (direction == 'right') {
        for (let x = startPos.x; x < img.bitmap.width; x++) {
          if (img.getPixelColor(x, startPos.y) != color) {
            return { x: x, y: startPos.y };
          }
        }
      }
    });
  }
}

var img_grid_3x3 = './testSubjects/3x3_full.png';
var captchaImageSegmenter = new CaptchaImageSegmenter();
captchaImageSegmenter.segmentCaptcha(img_grid_3x3);