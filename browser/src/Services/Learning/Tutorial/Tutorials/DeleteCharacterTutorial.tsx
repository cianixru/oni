/**
 * DeleteCharacterTutorial.tsx
 *
 * Tutorial that runs through deleting a character.
 */

import { ITutorial, ITutorialMetadata, ITutorialStage } from "./../ITutorial"
import * as Stages from "./../Stages"

const TutorialLine1Original = "The coww jumped over the mmoon"
const TutorialLine1Correct = "The cow jumped over the moon"
const TutorialLine2Original = "The bboy bougght the baskketball"
const TutorialLine2Correct = "The boy bought the basketball"
const TutorialLine3Original = "Modal edditing is the ccats pajammas"
const TutorialLine3Correct = "Modal editing is the cats pajamas"

export class DeleteCharacterTutorial implements ITutorial {
    private _stages: ITutorialStage[]

    constructor() {
        this._stages = [
            new Stages.SetBufferStage([TutorialLine1Original]),
            new Stages.CorrectLineStage("Remove the duplicated 'w'", 0, TutorialLine1Correct, "w"),
            new Stages.CorrectLineStage("Remove the duplicated 'm'", 0, TutorialLine1Correct, "m"),
            new Stages.SetBufferStage([TutorialLine1Correct, TutorialLine2Original]),
            new Stages.MoveToGoalStage("Move to the next line by pressing `j`", 1, null),
            new Stages.CorrectLineStage("Remove the duplicated 'b'", 1, TutorialLine2Correct, "b"),
            new Stages.CorrectLineStage("Remove the duplicated 'g'", 1, TutorialLine2Correct, "g"),
            new Stages.CorrectLineStage("Remove the duplicated 'k'", 1, TutorialLine2Correct, "k"),
            new Stages.SetBufferStage([
                TutorialLine1Correct,
                TutorialLine2Correct,
                TutorialLine3Original,
            ]),
            new Stages.MoveToGoalStage("Move to the next line by pressing `j`", 2, null),
            new Stages.CorrectLineStage("Remove the duplicated 'd'", 2, TutorialLine3Correct, "d"),
            new Stages.CorrectLineStage("Remove the duplicated 'c'", 2, TutorialLine3Correct, "c"),
            new Stages.CorrectLineStage("Remove the duplicated 'm'", 2, TutorialLine3Correct, "m"),
        ]
    }

    public get metadata(): ITutorialMetadata {
        return {
            id: "oni.tutorial.delete_character",
            name: "Deleting a Character",
            description:
                "In normal mode, you can quickly delete characters. Move to the character (using h/j/k/l) and press `x` to delete. Correct the above lines without going to insert mode.",
            level: 120,
        }
    }

    public get stages(): ITutorialStage[] {
        return this._stages
    }
}
