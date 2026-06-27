#kumbaatttt sys

import random
import time
from utils import loading_sequence
from constants import BASIC_ATTACK_COST, MAGIC_ATTACK_COST, HEAL_COST, BOSS_SPECIAL_ATTACK_CHANCE

def player_turn(player, enemy):
    player.regenerate_resources()
    print(f"\n[YOUR TURN] {player.name}")
    print(f"HP: {player.hp}/{player.max_hp} | MP: {player.mp}/{player.max_mp} | STA: {player.stamina}/{player.max_stamina}")
    print(f"{enemy.name}: HP: {enemy.hp}/{enemy.max_hp}")
    
    if enemy.debuff:
        print(f"[DEBUFF] Enemy affected: {enemy.debuff['type'].upper()} ({enemy.turns_affected+1}/{enemy.debuff['duration']})")
    
    print("\nActions:")
    print(f"[1] Basic Attack ({BASIC_ATTACK_COST} STA)")
    print(f"[2] Magic Attack ({MAGIC_ATTACK_COST} MP)")
    print("[3] Class Ultimate" + (" (READY!)" if player.ultimate_available else " (4 turns cooldown)"))
    print(f"[4] Cast Heal ({HEAL_COST} MP)")
    print("[5] Run")
    
    while True:
        choice = input("[CHOICE] What do you do? ").strip()
        
        if choice == "1":
            loading_sequence("[ACTION] Preparing attack", 1.2)
            damage = player.basic_attack()
            if damage > 0:
                actual_damage = max(1, damage - enemy.defense)
                enemy.hp -= actual_damage
                print(f"[DAMAGE] You strike the {enemy.name} for {actual_damage} damage!")
            return None
            
        elif choice == "2":
            loading_sequence("[ACTION] Channeling magic", 1.5)
            damage = player.magic_attack()
            if damage > 0:
                actual_damage = max(1, damage - enemy.magic_defense)
                enemy.hp -= actual_damage
                print(f"[DAMAGE] You blast the {enemy.name} for {actual_damage} damage!")
            return None
            
        elif choice == "3":
            loading_sequence("[ULTIMATE] Unleashing ultimate skill", 1.8)
            if player.use_ultimate(enemy):
                print("[ULTIMATE EXECUTED] Special skill complete!")
                time.sleep(0.5)
            return None
            
        elif choice == "4":
            loading_sequence("[HEALING] Casting healing spell", 1.2)
            player.cast_heal()
            return None
            
        elif choice == "5":
            loading_sequence("[ESCAPE] Attempting to flee", 1.0)
            escape_success = player.try_run(enemy.speed)
            if escape_success:
                print("[ESCAPE SUCCESS] You escaped successfully!")
                return "escaped"
            else:
                print("[ESCAPE FAILED] Could not escape!")
                loading_sequence("[ENEMY TURN] Enemy capitalizes on your failed escape", 0.8)
                if random.random() < 0.5:
                    enemy_damage = max(1, enemy.attack - player.base_defense + random.randint(-3, 5))
                    print(f"[ENEMY HIT] {enemy.name} strikes you for {enemy_damage} damage as you try to flee!")
                else:
                    enemy_damage = max(1, enemy.magic_attack - player.base_magic_defense + random.randint(-3, 5))
                    print(f"[ENEMY HIT] {enemy.name} hits you with magic for {enemy_damage} damage!")
                player.hp -= enemy_damage
                return None
            
        else:
            print("[ERROR] Invalid choice! Pick 1-5")

def handle_combat(player, enemy): #main cmbt handler w/ turn order
    player.turns_in_combat = 0
    player.ultimate_available = False
    
    print(f"\n[BATTLE START] {enemy.name} (HP: {enemy.hp}/{enemy.max_hp})")
    print(f"[SPEED] Your Speed: {player.calculate_total_speed()} | Enemy Speed: {enemy.speed}")
    time.sleep(0.8)
    
    while enemy.hp > 0 and player.hp > 0:
        player.turns_in_combat += 1
        
        if player.turns_in_combat % 4 == 0 and player.turns_in_combat > 0:
            player.ultimate_available = True
            loading_sequence("[ULTIMATE READY] Your class ultimate is now available", 1.0)
        
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
                loading_sequence("[ENEMY TURN] Enemy is attacking", 1.2)
                if random.random() < 0.5:
                    enemy_damage = max(1, enemy.attack - player.base_defense + random.randint(-5, 8))
                    print(f"[ENEMY HIT] {enemy.name} strikes you for {enemy_damage} physical damage!")
                else:
                    enemy_damage = max(1, enemy.magic_attack - player.base_magic_defense + random.randint(-5, 8))
                    print(f"[ENEMY HIT] {enemy.name} hits you with magic for {enemy_damage} damage!")
        
                player.hp -= enemy_damage
        
                if enemy.is_boss and random.random() < BOSS_SPECIAL_ATTACK_CHANCE:
                    loading_sequence("[BOSS] Preparing special attack", 1.0)
                    print(f"[BOSS ATTACK] {enemy.name} uses their ULTIMATE ATTACK!")
                    extra_damage = random.randint(15, 30)
                    player.hp -= extra_damage
                    print(f"[CRITICAL] Extra {extra_damage} damage!")
                    time.sleep(0.5)
        
                if player.hp <= 0:
                    break
        
        if not player_goes_first and player.hp > 0 and enemy.hp > 0:
            result = player_turn(player, enemy)
            if result == "escaped" or result == "defeated":
                return result
        
        time.sleep(0.5)
    
    if player.hp <= 0:
        loading_sequence("[GAME OVER] You have been defeated", 1.5)
        print(f"\n[DEATH] You were defeated by the {enemy.name}!")
        return "defeated"
    elif enemy.hp <= 0:
        loading_sequence("[VICTORY] You defeated the enemy", 1.5)
        print(f"\n[WIN] Victory! You defeated the {enemy.name}!")
        print(f"[REWARD] Gained {enemy.exp_reward} EXP!")
        player.add_exp(enemy.exp_reward)
        
        # Small recovery after battle
        player.hp = min(player.max_hp, player.hp + 10)
        player.mp = min(player.max_mp, player.mp + 5)
        player.stamina = min(player.max_stamina, player.stamina + 15)
        return "victory"
    
    return "unknown"