import adjectiveList from "~/utils/adjectives.json";
import characterList from "~/utils/characters.json";

export function uniqueNameGenerator(discordId: string): string {
    const seed = BigInt(discordId);
    
    const adjectiveIndex = Number(seed % BigInt(adjectiveList.length));
    const characterIndex = Number((seed >> 32n) % BigInt(characterList.length));
    
    const adjective = adjectiveList[adjectiveIndex];
    const character = characterList[characterIndex].name;
        
    // Capitalize first letter of both words
    const capitalizedAdjective = adjective.charAt(0).toUpperCase() + adjective.slice(1);
    const capitalizedCharacter = character.charAt(0).toUpperCase() + character.slice(1);
    
    return `${capitalizedAdjective} ${capitalizedCharacter}`;
}