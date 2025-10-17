let loadingDiv: HTMLElement = document.querySelector('#loadingDiv') as HTMLElement;
export default function setLoadingMessage(message:string) {
    if (loadingDiv) {
        loadingDiv.innerText = message;
    }
}