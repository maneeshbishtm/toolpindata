
import { BOARD_IDS, BOARD_DISPLAY_INFO, BOARD_DATA } from './src/data/boards';

const results = [];

BOARD_DISPLAY_INFO.forEach(board => {
    if (board.isParent) {
        const subBoards = BOARD_DISPLAY_INFO.filter(b => b.parentId === board.id);
        subBoards.forEach(sub => {
            if (!BOARD_DATA[sub.id] || BOARD_DATA[sub.id].length === 0) {
                results.push({
                    parent: board.label,
                    parentId: board.id,
                    sub: sub.label,
                    subId: sub.id
                });
            }
        });
    }
});

console.log(JSON.stringify(results, null, 2));
