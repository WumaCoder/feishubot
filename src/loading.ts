const Loading = ["⠇", "⠋", "⠙", "⠸", "⠴", "⠦"];

export function next(current: number) {
	return Loading[current % Loading.length];
}
