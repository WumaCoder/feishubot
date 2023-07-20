export function parseBtns(btns: string[]) {
	return btns.map((item) => {
		const [text, value] = item.split(":");
		return { text, value };
	});
}

export const createContent = ({
	template_id,
	...template_variable
}: {
	btns: any;
	content: string;
	foot_text: string;
	template_id: string;
	title: string;
}) => {
	return JSON.stringify({
		data: {
			template_id,
			template_variable,
		},
		type: "template",
	});
};
