var Jimp = require('jimp');

const whiteColor = 4294967295;
const blueColor = 1251009279;

class CaptchaImageSegmenter {
  async segmentCaptcha(image) {
    await Jimp.read(image).then(async (img) => {
      let captchaFrame = await this.getCaptchaFrame(img);
      let captchaImage = img.clone().crop(captchaFrame.frameLeft, captchaFrame.frameTop, captchaFrame.frameWidth, img.bitmap.height - captchaFrame.frameTop);
      captchaImage.write('./testSubjects/captchaImage.png');
  
      let instructionFrame = await this.getInstructionBoxFrame(captchaImage);
      let instructionImage = captchaImage.clone().crop(instructionFrame.frameLeft, instructionFrame.frameTop, instructionFrame.frameWidth, instructionFrame.frameBottom - instructionFrame.frameTop);
      instructionImage.write('./testSubjects/instructionImage.png');

      let tileGridFrame = await this.getTileGridFrame(captchaImage, instructionFrame);
      
    });
  }

  async getInstructionBoxFrame(captchaImg) {
    return await Jimp.read(captchaImg).then(async (img) => {
      let frameTop = await this.getFrameTop(img);
      let frameEnds = await this.getFrameEnds(img, frameTop);
      let frameLeft = frameEnds.frameLeftEnd;
      let frameRight = frameEnds.frameRightEnd;
      let frameBottom = await this.getInstructionFrameBottom(img, frameTop, frameLeft);
      let frameWidth = img.bitmap.width - frameLeft - (img.bitmap.width - frameRight);

      return {frameTop, frameLeft, frameRight, frameWidth, frameBottom};
    })
  }

  async getCaptchaFrame(img) {
    return await Jimp.read(img).then(async (img) => {
      let frameTop = await this.getFrameTop(img);
      let frameEnds = await this.getFrameEnds(img, frameTop);
      let frameLeft = frameEnds.frameLeftEnd;
      let frameRight = frameEnds.frameRightEnd;
      let frameWidth = img.bitmap.width - frameLeft - (img.bitmap.width - frameRight);

      return {frameTop, frameLeft, frameRight, frameWidth};
    });
  }

  // Start from top-left corner of instructionBox and go down till bottom is reached
  async getInstructionFrameBottom(img, frameTop, frameLeft) {
    let frameBottom = 0;

    return await Jimp.read(img).then((img) => {
      for (let y = frameTop; y < img.bitmap.height; y++) {
        if (img.getPixelColor(frameLeft, y) != blueColor) {
          frameBottom = y;
          console.log(y);
          
          break;
        }
      }
      return frameBottom;
    })
  }

  // Start from top-middle and go down till the top of the frame is found
  async getFrameTop(img) {
    let imageMiddle = img.bitmap.width / 2;
    let frameTop = 0;

    return await Jimp.read(img).then((img) => {
      for (let y = 0; y < img.bitmap.height; y++) {
        if (img.getPixelColor(imageMiddle, y) != whiteColor) {
          // +1 since we don't want the frame
          frameTop = y+1;
          break;
        }
      }
      return frameTop;
    });
  }

  // Start from each side and move towards the middle until both frame ends are found
  async getFrameEnds(img, frameTop) {
    let frameLeftEnd = 0;
    let frameRightEnd = 0;
    
    return await Jimp.read(img).then((img) => {
      // First go right until the left end of the frame is found.
      for (let x = 0; x < img.bitmap.width; x++) {
        if (img.getPixelColor(x, frameTop) != whiteColor) {
          // +1 since we don't want the frame
          frameLeftEnd = x+1;
          break;
        }
      }

      // Then go left until the right end of the frame is found.
      for (let x = img.bitmap.width; x > 0; x--) {
        if (img.getPixelColor(x, frameTop) != whiteColor) {
          frameRightEnd = x;
          break;
        }
      }
      return {frameLeftEnd, frameRightEnd};
    });
  }
}

var img_grid_3x3 = './testSubjects/3x3_full.png';
var captchaImageSegmenter = new CaptchaImageSegmenter();
captchaImageSegmenter.segmentCaptcha(img_grid_3x3);