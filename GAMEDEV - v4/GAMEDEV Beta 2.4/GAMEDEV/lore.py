#paylee pur game info, lores, mob infos and about adventurer(you/ikaw)

import time
from ui import Colors
from player import Player

def show_intro_story():
    
    print("\n" + "="*50)
    print(f"{Colors.BOLD_YELLOW}THE WORLD OF RUINED HEARTS{Colors.RESET}")
    print("="*50)
    time.sleep(1)

    #Game Lore
    print(f"\n{Colors.YELLOW}[LORE]{Colors.RESET}")
    print(f"Many years have passed since the {Colors.BOLD_RED}Crimson Lament{Colors.RESET} in Colwyn Kingdom, where the Nia died and Noir took the Tyrant King's head.")
    print("For years, Noir ruled as the Ruined King—silent, starving, speaking only to Nia's ghost.")
    print("His grief turned to wrath. He erased bloodlines. No prisoners. No mercy...")
    print("He slept beside a mannequin dressed in her gown, executed advisors who offered comfort, and burned villages that reminded him of her.")
    print("By year eighteen of his reign, he had killed thousands, dawning a cloak woven from his enemies' hair. At night he screams at the air for not answering...")
    print(f"What he does not know: Nia was with child before the {Colors.BOLD_RED}Crimson Lament{Colors.RESET} happened...")
    print("She gave birth in secret, left the heir with her loyal retainer, and went off to battle...")
    print("That child is now of age. Their burden: redeem their father… or end him.")
    time.sleep(2)

    #About Ruined Hearts RPG
    print(f"\n{Colors.YELLOW}[ABOUT THE GAME]{Colors.RESET}")
    print("You will explore perilous lands, fight monsters, collect powerful weapons, and end your father's reign for good.")
    print("The game is based on D&D. Instead of conquering a dungeon, you encounter randomized scenarios.")
    print("RNG determines most of the game—your class (if you don't choose), the scenarios you face, and the treasures you find.")
    print("This game is a narrative experience that does not hold your hand")
    print("Unexpected encounters and choices will shape your destiny")
    time.sleep(2)

    #About the Adventurer(You dimdim)
    print(f"\n{Colors.CYAN}[YOUR STORY]{Colors.RESET}")
    print(f"You are an Adventurer seeking answers.")
    print("And the child of Nia and Noir — the last heir to House De Valis, and the last blood of House Colwyn.")
    time.sleep(2)

    #Monster Lore and Infos
MOB_INFO = {
    # ===== NORMAL ENEMIES =====
    "Slime": {
        "lore": f"{Colors.GREEN}A gelatinous creature born from corrupted swamps.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High physical defense (15){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low magic defense (8){Colors.RESET}",
        "best_stat": "DEFENSE",
    },
    
    "Goblin": {
        "lore": f"{Colors.GREEN}Cunning little thieves that attack in packs.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High speed (29){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low defense (8) and magic defense (6){Colors.RESET}",
        "best_stat": "SPEED",
    },
    
    "Wolf": {
        "lore": f"{Colors.GREEN}A pack hunter with keen senses and sharp fangs.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High speed (24) and attack (28){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low defense (10) and health (65){Colors.RESET}",
        "best_stat": "SPEED",
    },
    
    "Skeleton": {
        "lore": f"{Colors.GREEN}Undead warriors raised by dark necromancy.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High defense (15), balanced physical stats{Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low magic defense (7){Colors.RESET}",
        "best_stat": "DEFENSE",
    },
    
    "Dark Elf": {
        "lore": f"{Colors.GREEN}Shadow-dwellers who wield both blade and sorcery.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High magic attack (35), attack (29) and speed (30){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Lower defense (13){Colors.RESET}",
        "best_stat": "MAGIC_ATTACK",
    },
    
    "Orc": {
        "lore": f"{Colors.GREEN}Brutal warriors driven by pure rage and strength.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High HP (120) and attack (45){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Slow speed (11), low magic attack (3){Colors.RESET}",
        "best_stat": "ATTACK",
    },
    
    "Harpy": {
        "lore": f"{Colors.GREEN}Winged creatures that lure victims with enchanting songs.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Very high speed (38), and magic attack (35){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low physical defense (10){Colors.RESET}",
        "best_stat": "SPEED",
    },
    
    "Minotaur": {
        "lore": f"{Colors.GREEN}A fearsome labyrinth guardian with unmatched strength.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High HP (130), attack (50), and defense (20){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Very slow (14), low magic stats{Colors.RESET}",
        "best_stat": "ATTACK",
    },
    
    "Wisp": {
        "lore": f"{Colors.GREEN}Ghostly lights that lead travelers to their doom.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High magic attack (42) and speed (28){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Tiny HP pool (50), low magic defense (14){Colors.RESET}",
        "best_stat": "MAGIC_ATTACK",
    },
    
    "Gargoyle": {
        "lore": f"{Colors.GREEN}Stone sentinels that guard ancient cathedrals and tombs.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Very high defense (25), good HP (100){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low magic defense (15), slow speed (10){Colors.RESET}",
        "best_stat": "DEFENSE",
    },
    
    # ===== BOSS ENEMIES =====
    "Death Knight": {
        "lore": f"{Colors.PURPLE}A fallen paladin bound to eternal service in death.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}High HP (300), attack (52), balanced defenses{Colors.RESET}",
        "weaknesses": f"{Colors.RED}Medium speed (30), lower magic defense (19){Colors.RESET}",
        "best_stat": "ATTACK",
    },
    
    "Lich": {
        "lore": f"{Colors.PURPLE}An immortal necromancer whose soul is bound to a phylactery.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Extremely high magic attack (85), high magic defense (40){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low defense (22), medium HP (350){Colors.RESET}",
        "best_stat": "MAGIC_ATTACK",
    },
    
    "Ruined King": {
        "lore": f"{Colors.PURPLE}Conqueror of Colwyn, Victor of the Crimson Lament, Noir the Ruined King.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Massive HP (450), high attack (68), high defense (38){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Lower speed (27), lower magic defense (28){Colors.RESET}",
        "best_stat": "DEFENSE",
    },
    
    "Ancient Dragon": {
        "lore": f"{Colors.PURPLE}A primordial beast that predates human civilization.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Highest HP (600), highest magic attack (98), extreme speed (58){Colors.RESET}",
        "weaknesses": f"{Colors.RED}No major weaknesses{Colors.RESET}",
        "best_stat": "MAGIC_ATTACK",
    },
    
    "Hydra": {
        "lore": f"{Colors.PURPLE}A massive serpent with multiple heads that grow back.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Massive HP (550), high attack (70){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Low speed (25), lower magic defense (30){Colors.RESET}",
        "best_stat": "HP",
    },
    
    "Hellhound": {
        "lore": f"{Colors.PURPLE}Infernal beast from the underworld, breathes eternal flame.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Extreme speed (45), high attack (58){Colors.RESET}",
        "weaknesses": f"{Colors.RED}Lower HP (280), lower defense (22){Colors.RESET}",
        "best_stat": "SPEED",
    },
}

def get_mob_info(mob_name):
    return MOB_INFO.get(mob_name, {
        "lore": f"{Colors.GREEN}A mysterious creature of unknown origin.{Colors.RESET}",
        "strengths": f"{Colors.YELLOW}Unknown{Colors.RESET}",
        "weaknesses": f"{Colors.RED}Unknown{Colors.RESET}",
        "best_stat": "UNKNOWN",
    })