/// <reference types="nativewind/types" />

// L'import de global.css est un effet de bord traité par Metro, pas un module
// TypeScript : cette déclaration lui donne un type.
declare module '*.css';
