#kumbaatttt sys

import random
import sys
import time
from utils import loading_sequence, calculate_player_damage, calculate_enemy_damage
from constants import BASIC_ATTACK_COST, MAGIC_ATTACK_COST, HEAL_COST, BOSS_SPECIAL_ATTACK_CHANCE
from ui import Colors, print_combat, print_damage, print_healing, print_success, print_error
from lore import get_mob_info

def player_turn(player, enemy):
    player.regenerate_resources()

    if player.ultimate_available:
        ult_text = "READY!"
    else:
        
        turn_mod = player.turns_in_combat % 4
        if turn_mod == 0:
            remaining = 4
        else:
            remaining = 4 - turn_mod
        ult_text = f"({remaining} turns left)"

    print(f"\n{Colors.GREEN}[YOUR TURN]{Colors.RESET} {player.turns_in_combat}")
    print(f"{Colors.RED}HP:{Colors.RESET} {player.hp}/{player.max_hp} | {Colors.BLUE}MP:{Colors.RESET} {player.mp}/{player.max_mp} | {Colors.GREEN}STA:{Colors.RESET} {player.stamina}/{player.max_stamina}")
    print(f"{enemy.name}: {Colors.RED}HP:{Colors.RESET} {enemy.hp}/{enemy.max_hp}")
    
    if enemy.debuff:
        print(f"{Colors.RED}[DEBUFF]{Colors.RESET} Enemy affected: {enemy.debuff['type'].upper()} ({enemy.turns_affected+1}/{enemy.debuff['duration']})")
    
    if player.ultimate_available:
        ult_text = "READY!"
    else:
        remaining = 4 - (player.turns_in_combat % 4)
        if remaining == 0:
            remaining = 4
        ult_text = f"({remaining} turns left)"
    
    print("\nActions:")
    print(f"[1] Basic Attack ({BASIC_ATTACK_COST} STA)")
    print(f"[2] Magic Attack ({MAGIC_ATTACK_COST} MP)")
    print(f"[3] Class Ultimate {ult_text}")
    print(f"[4] Cast Heal ({HEAL_COST} MP)")
    print("[5] Run")
    
    while True:
        choice = input(f"{Colors.BOLD}[CHOICE]{Colors.RESET} What do you do? ").strip()
        
        if choice == "1":
            loading_sequence(f"{Colors.BOLD}[ACTION]{Colors.RESET} Preparing attack", 1.2)
            actual_damage = calculate_player_damage(player, enemy, "basic")
            if actual_damage > 0:
                enemy.hp -= actual_damage
                print(f"{Colors.RED}[DAMAGE]{Colors.RESET} You strike the {enemy.name} for {actual_damage} damage!")
            return None
            
        elif choice == "2":
            loading_sequence(f"{Colors.BOLD}[ACTION]{Colors.RESET} Channeling magic", 1.5)
            actual_damage = calculate_player_damage(player, enemy, "magic")
            if actual_damage > 0:
                enemy.hp -= actual_damage
                print(f"{Colors.RED}[DAMAGE]{Colors.RESET} You blast the {enemy.name} for {actual_damage} damage!")
            return None
            
        elif choice == "3":
            loading_sequence(f"{Colors.BOLD_PURPLE}[ULTIMATE]{Colors.RESET} Unleashing ultimate skill", 1.8)
            if player.use_ultimate(enemy):
                print(f"{Colors.BOLD_PURPLE}[ULTIMATE EXECUTED]{Colors.RESET} Special skill complete!")
                time.sleep(0.5)
            return None
            
        elif choice == "4":
            loading_sequence(f"{Colors.GREEN}[HEALING]{Colors.RESET} Casting healing spell", 1.2)
            player.cast_heal()
            return None
            
        elif choice == "5":
            loading_sequence(f"{Colors.YELLOW}[ESCAPE]{Colors.RESET} Attempting to flee", 1.0)
            escape_success = player.try_run(enemy.speed)
            if escape_success:
                print(f"{Colors.GREEN}[ESCAPE SUCCESS]{Colors.RESET} You escaped successfully!")
                return "escaped"
            else:
                print(f"{Colors.RED}[ESCAPE FAILED]{Colors.RESET} Could not escape!")
                loading_sequence(f"{Colors.RED}[ENEMY TURN]{Colors.RESET} Enemy capitalizes on your failed escape", 0.8)
                if random.random() < 0.5:
                    enemy_damage = max(1, enemy.attack - player.base_defense + random.randint(-3, 5))
                    print(f"{Colors.RED}[ENEMY HIT]{Colors.RESET} {enemy.name} strikes you for {enemy_damage} damage as you try to flee!")
                else:
                    enemy_damage = max(1, enemy.magic_attack - player.base_magic_defense + random.randint(-3, 5))
                    print(f"{Colors.RED}[ENEMY HIT]{Colors.RESET} {enemy.name} hits you with magic for {enemy_damage} damage!")
                player.hp -= enemy_damage
                return None
            
        else:
            print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid choice! Pick 1-5")

def handle_combat(player, enemy): #main cmbt handler w/ turn order
    mob_info = get_mob_info(enemy.name)
    print(f"\n{Colors.BOLD_CYAN}[MONSTER INFO]{Colors.RESET}")
    print(mob_info["lore"])
    print(f"{Colors.YELLOW}Strengths: {mob_info['strengths']}{Colors.RESET}")
    print(f"{Colors.RED}Weaknesses: {mob_info['weaknesses']}{Colors.RESET}")
    print(f"{Colors.GREEN}Best Stat: {mob_info['best_stat']}{Colors.RESET}")
    print("-" * 40)
    time.sleep(2)

    player.turns_in_combat = 0
    player.ultimate_available = False
    
    print(f"\n{Colors.BOLD}[BATTLE START]{Colors.RESET} {enemy.name} ({Colors.GREEN}HP:{Colors.RESET} {enemy.hp}/{enemy.max_hp})")
    print(f"{Colors.BOLD}[SPEED]{Colors.RESET} Your Speed: {player.calculate_total_speed()} | Enemy Speed: {enemy.speed}")
    time.sleep(0.8)
    
    while enemy.hp > 0 and player.hp > 0:
        player.turns_in_combat += 1
        print(f"\n{Colors.GREEN}[YOUR TURN]{Colors.RESET} {player.turns_in_combat}")
        
        if player.turns_in_combat % 4 == 0:
            if not player.ultimate_available:
                player.ultimate_available = True
                loading_sequence(f"{Colors.BOLD_PURPLE}[ULTIMATE READY]{Colors.RESET}Your class ultimate is now available", 1.0)

        player_speed = player.calculate_total_speed()
        enemy_speed = enemy.speed
        
        if enemy.debuff and enemy.debuff.get("type") in ["freeze", "slow"]:
            enemy_speed = max(1, enemy_speed // 2)
        
        player_goes_first = player_speed >= enemy_speed
        
        if player_goes_first:
            result = player_turn(player, enemy)
            if result == "escaped" or result == "defeated":
                return result
            if enemy.hp <= 0:
                break
        
        if enemy.hp > 0:
            skip_enemy = enemy.apply_debuff()
    
            if not skip_enemy and enemy.hp > 0:
                loading_sequence(f"{Colors.RED}[ENEMY TURN]{Colors.RESET} Enemy is attacking", 1.2)
                enemy_damage, damage_type = calculate_enemy_damage(enemy, player, enemy.is_boss)

                if damage_type == "physical":
                    print(f"{Colors.RED}[ENEMY HIT]{Colors.RESET} {enemy.name} strikes you for {enemy_damage} physical damage!")
                else:
                    print(f"{Colors.RED}[ENEMY HIT]{Colors.RESET} {enemy.name} hits you with magic for {enemy_damage} damage!")
                    time.sleep()

                player.hp -= enemy_damage
        
                if enemy.is_boss and random.random() < BOSS_SPECIAL_ATTACK_CHANCE:
                    loading_sequence(f"{Colors.BOLD_PURPLE}[BOSS]{Colors.RESET} Preparing special attack", 1.0)
                    print(f"{Colors.RED}[BOSS ATTACK]{Colors.RESET} {enemy.name} uses their ULTIMATE ATTACK!")
                    extra_damage = random.randint(15, 30)
                    player.hp -= extra_damage
                    print(f"{Colors.BOLD_YELLOW}[CRITICAL]{Colors.RESET} Extra {extra_damage} damage!")
                    time.sleep(0.5)
        
                if player.hp <= 0:
                    break
        
        if not player_goes_first and player.hp > 0 and enemy.hp > 0:
            result = player_turn(player, enemy)
            if result == "escaped" or result == "defeated":
                return result
        
        time.sleep(0.5)
    
    if player.hp <= 0:
        loading_sequence(f"{Colors.RED}[GAME OVER]{Colors.RESET} You have been defeated", 1.5)
        print(f"\n{Colors.BOLD_RED}[DEATH]{Colors.RESET} You were defeated by the {enemy.name}!")
        return "defeated"
    elif enemy.hp <= 0:
        loading_sequence(f"{Colors.GREEN}[VICTORY]{Colors.RESET} You defeated the enemy", 1.5)
        print(f"\n{Colors.GREEN}[WIN]{Colors.RESET} Victory! You defeated the {enemy.name}!")
        if enemy.name == "Ruined King":
            if enemy.hp <= 0:
                print("\n\n[VICTORY] You have defeated the final boss!")
                print("[EXIT] Thanks for playing!")
                sys.exit(0)
        print(f"{Colors.YELLOW}[REWARD]{Colors.RESET} Gained {enemy.exp_reward} EXP!")
        player.add_exp(enemy.exp_reward)
        
        #buff handling chuichu
        if player.active_buff and player.buff_encounters_remaining > 0:
            player.buff_encounters_remaining -= 1
            print(f"\n{Colors.BOLD_BLUE}[BUFF STATUS]{Colors.RESET} Ally remains for {player.buff_encounters_remaining} more encounter(s)")

            if player.buff_encounters_remaining <= 0:
                print("[BUFF END] Your ally departs...")
                for stat, value in player.active_buff:
                    if stat == "attack":
                        player.base_attack -= value
                    elif stat == "defense":
                        player.base_defense -= value
                    elif stat == "magic_attack":
                        player.base_magic_attack -= value
                    elif stat == "magic_defense":
                        player.base_magic_defense -= value
                    elif stat == "speed":
                        player.base_speed -= value
                    print(f"  -{value} {stat.capitalize()}")
                player.active_buff = None

        # Small recovery after battle
        player.hp = min(player.max_hp, player.hp + 10)
        player.mp = min(player.max_mp, player.mp + 5)
        player.stamina = min(player.max_stamina, player.stamina + 15)
        return "victory"
    
    return "unknown"