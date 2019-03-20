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
      let tileGridImage = captchaImage.clone().crop(tileGridFrame.frameLeft, tileGridFrame.frameTop, tileGridFrame.frameRight, tileGridFrame.frameHeight);
      tileGridImage.write('./testSubjects/tileGrid.png');

      // Tile Segmentation
      let tiles = await this.getTilesInGrid(tileGridImage);

      for (let i = 0; i < tiles.length; i++) {
        let tileImage = tileGridImage.clone().crop(tiles[i].tileTopLeft.x, tiles[i].tileTopLeft.y, tiles[i].width, tiles[i].height);
        let tileImageName = ('./testSubjects/' + 'c' + tiles[i].column.toString() + '_' + 'r' + tiles[i].row.toString() + '.png');
        tileImage.write(tileImageName);
      }
    }).catch(err => console.log("Failed to segment captcha!"));
  }

  async getCaptchaFrame(img) {
    return await Jimp.read(img).then(async (img) => {
      // Start from top-middle and go down till the top of the frame is found
      // Then find the edges by moving towards the middle until the edges are found
      let frameTopPos = await this.getColorChangedPosition(img, { x: img.bitmap.width / 2, y: 0 }, 'down', whiteColor);
      let frameTop = frameTopPos.y + 1; // +1 since we dont wan't the actual grey frame
      let frameLeftPos = await this.getColorChangedPosition(img, { x: 0, y: frameTop }, 'right', whiteColor);
      let frameLeft = frameLeftPos.x + 1; // +1 since we dont wan't the actual grey frame
      let frameRightPos = await this.getColorChangedPosition(img, { x: img.bitmap.width, y: frameTop }, 'left', whiteColor);
      let frameRight = frameRightPos.x;

      let frameWidth = (img.bitmap.width - frameLeft) - (img.bitmap.width - frameRight);

      return { frameTop, frameLeft, frameRight, frameWidth };
    }).catch(err => console.log("There was an error segmenting the Captcha frame"));
  }

  async getInstructionBoxFrame(captchaImg) {
    return await Jimp.read(captchaImg).then(async (img) => {
      // Start from the top-middle and go down till the top of the instruction frame is found
      // Then find the edges by moving towards the middle until edges are found
      // Finally move from the left edge down till the bottom is found
      let frameTopPos = await this.getColorChangedPosition(img, { x: img.bitmap.width / 2, y: 0 }, 'down', whiteColor);
      let frameTop = frameTopPos.y;
      let frameLeftPos = await this.getColorChangedPosition(img, { x: 0, y: frameTop }, 'right', whiteColor);
      let frameLeft = frameLeftPos.x;
      let frameRightPos = await this.getColorChangedPosition(img, { x: img.bitmap.width, y: frameTop }, 'left', whiteColor);
      let frameRight = frameRightPos.x;
      let frameBottomPos = await this.getColorChangedPosition(img, { x: frameLeft, y: frameTop }, 'down', blueColor);
      let frameBottom = frameBottomPos.y;

      let frameWidth = (img.bitmap.width - frameLeft) - (img.bitmap.width - frameRight);

      return { frameTop, frameLeft, frameRight, frameWidth, frameBottom };
    }).catch(err => console.log("There was an error segmenting the Instruction Box frame"));
  }

  async getTileGridFrame(captchaImg, instructionFrame) {
    return await Jimp.read(captchaImg).then(async (img) => {
      // Assign the top by moving through the instruction box till the bottom edge is reached
      // Left and right edges are just the image edges
      // Go down the left edge until the bottom frame is reached
      let frameTopPos = await this.getColorChangedPosition(img, { x: instructionFrame.frameLeft, y: instructionFrame.frameBottom }, 'down', blueColor);
      let frameTop = frameTopPos.y;
      let frameLeft = 0;
      let frameRight = img.bitmap.width;
      let frameBottomPos = await this.getColorChangedPosition(img, { x: frameLeft, y: frameTop }, 'down', whiteColor);
      let frameBottom = frameBottomPos.y;

      let frameHeight = (img.bitmap.height - frameTop) - (img.bitmap.height - frameBottom);

      return { frameTop, frameLeft, frameRight, frameBottom, frameHeight };
    }).catch(err => console.log("There was an error segmenting the Tile Grid"));
  }

  async getTilesInGrid(tileGridImg) {
    return await Jimp.read(tileGridImg).then(async (img) => {
      let tiles = [];

      // Find and define the first tile (top-left tile)
      let firstTile = await this.defineFirstTile(img);
      firstTile.row = 0;
      firstTile.column = 0;

      let tileTopLeftPositions = await this.getAllTileTopLeftCorners(img, firstTile);
      
      for (let row = 0; row < tileTopLeftPositions.length; row++) {
        for (let tileRowIndex = 0; tileRowIndex < tileTopLeftPositions[row].length; tileRowIndex++) {
          let tileTopLeft = tileTopLeftPositions[row][tileRowIndex];
          let tile = await this.defineTileFromTopLeft(img, tileTopLeft);
          tile.row = row;
          tile.column = tileRowIndex;
          tiles.push(tile);
        }
      }

      return tiles;
    }).catch(err => console.log("There was an error segmenting the Tiles in the Grid"));
  }

  async getAllTileTopLeftCorners(tileGridImg, firstTile) {
    return await Jimp.read(tileGridImg).then(async (img) => {
      let tileTopLeftPositions = [];

      // Find all the top-left corners of the first column by scanning for all tiles below the first tile
      let firstColumn = await this.scanTilesInDirection(img, firstTile.tileTopLeft, 'down');

      for (let i = 0; i < firstColumn.length; i++) {
        let row = await this.scanTilesInDirection(img, firstColumn[i], 'right');
        tileTopLeftPositions.push(row);
      }

      return tileTopLeftPositions;
    });
  }
  async scanTilesInDirection(tileGridImg, firstTileTopLeft, direction) {
    return await Jimp.read(tileGridImg).then(async (img) => {
      let tileTopLeftPositions = [];
      // We're returning an array of tiles' top-left corners, so here we just add the initial tile we're scanning from
      tileTopLeftPositions.push(firstTileTopLeft);

      // Flag is set to false when there are no more tiles in the given direction
      let flag = true;
      // The current tile in reference. We use this for the getNextTileLeftPos() method which returns the tile immediatly next to it in a given direction
      let currTileTopLeft = firstTileTopLeft;

      // Keep looking for tiles until flag is false, meaning there are no further tiles in given direction
      for (let i = 0; flag; i++) {
        let tileLeftPos = await this.getNextTileLeftPos(img, currTileTopLeft, direction);
        
        if (tileLeftPos == null) {
          flag = false;
          break;
        }
        tileTopLeftPositions.push(tileLeftPos);
        currTileTopLeft = tileLeftPos;
      }
      
      return tileTopLeftPositions;
    });
  }

  async getNextTileLeftPos(tileGridImg, previousTileLeftPos, direction) {
    return await Jimp.read(tileGridImg).then(async (img) => {
      let tileRightPos = await this.getColorOccurence(img, previousTileLeftPos, direction, whiteColor);
      return await this.getColorChangedPosition(img, tileRightPos, direction, whiteColor);
    });
  }

  async defineTileFromTopLeft(tileGridImg, tileTopLeft) {
    return await Jimp.read(tileGridImg).then(async (img) => {
      // Find the rest of the corners for that tile
      let tileTopRight = await this.getColorOccurence(img, tileTopLeft, 'right', whiteColor);
      tileTopRight.x--;
      // console.log(tileTopRight);
      
      let tileBottomLeft = await this.getColorOccurence(img, tileTopLeft, 'down', whiteColor);
      tileBottomLeft.y--;
      let tileBottomRight = await this.getColorOccurence(img, tileTopRight, 'down', whiteColor);
      tileBottomRight.y--;
      // console.log(tileBottomRight);
      let width = tileTopRight.x - tileTopLeft.x;
      let height = tileBottomLeft.y - tileTopLeft.y;

      return { tileTopLeft, tileTopRight, tileBottomLeft, tileBottomRight, width, height };
    }).catch(err => console.log("There was an error defining the Tile with the given top-left position"));
  }

  async defineFirstTile(tileGridImg) {
    return await Jimp.read(tileGridImg).then(async (img) => {
      let topLeft;

      // Find top-left corner of the first tile
      for (let x = 0; x < img.bitmap.width; x++) {
        let pos = await this.getColorChangedPosition(img, { x: x, y: 0 }, 'down', whiteColor);
        if (pos != null) {
          topLeft = pos;
          break;
        }
      }
      // Rest of the corners
      return this.defineTileFromTopLeft(img, topLeft);
    }).catch(err => console.log("There was an error finding the top-left corner of the first Tile"));
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
      return null;
    }).catch(err => console.log("Error in getColorChangedPosition..."));
  }

  async getColorOccurence(image, startPos, direction, color) {
    return await Jimp.read(image).then((img) => {
      if (direction == 'up') {
        for (let y = startPos.y; y > 0; y--) {
          if (img.getPixelColor(startPos.x, y) == color) {
            return { x: startPos.x, y: y };
          }
        }
      } else if (direction == 'down') {
        for (let y = startPos.y; y < img.bitmap.height; y++) {
          if (img.getPixelColor(startPos.x, y) == color) {
            return { x: startPos.x, y: y };
          }
        }
      } else if (direction == 'left') {
        for (let x = startPos.x; x > 0; x--) {
          if (img.getPixelColor(x, startPos.y) == color) {
            return { x: x, y: startPos.y };
          }
        }
      } else if (direction == 'right') {
        for (let x = startPos.x; x < img.bitmap.width; x++) {
          if (img.getPixelColor(x, startPos.y) == color) {
            return { x: x, y: startPos.y };
          }
        }
      }
      return null;
    }).catch(err => console.log("Error in getColorOccurence..."));
  }
}

var img_grid_3x3 = './testSubjects/3x3_full.png';
var captchaImageSegmenter = new CaptchaImageSegmenter();
captchaImageSegmenter.segmentCaptcha(img_grid_3x3);